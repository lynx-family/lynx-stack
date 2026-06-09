# System Prompts

生成和定制用于指导 LLM 输出合法 A2UI 消息的系统提示词。

大多数部署场景可以用 CLI 生成一份可复用的 prompt 文件；如果后端需要按请求、环境或 catalog 动态拼装提示词，也可以在 Node.js 代码里通过 API 构建。生成的 prompt 会告诉模型如何输出 A2UI v0.9 JSON，内容包含协议规则、组件 catalog、函数签名、已验证示例，以及保证渲染输出安全、可解析的硬性约束。

## 1. CLI

如果后端只需要一份静态 prompt 文件，可以使用 `npx @lynx-js/genui a2ui generate prompt`。

使用内置 A2UI basic catalog 生成 prompt：

```bash
npx @lynx-js/genui a2ui generate prompt --out dist/a2ui-system-prompt.txt
```

输出到 stdout：

```bash
npx @lynx-js/genui a2ui generate prompt
```

追加部署侧的额外指令：

```bash
npx @lynx-js/genui a2ui generate prompt \
  --appendix "Prefer compact mobile layouts for travel booking flows." \
  --out dist/a2ui-system-prompt.txt
```

默认情况下，`generate prompt` 会使用内置 A2UI basic catalog。生成出的 prompt 会要求 `createSurface.catalogId` 与 prompt 中的 catalog id 一致。

### 自定义 catalog

如果使用自定义组件，需要先生成 catalog 产物：

```bash
npx @lynx-js/genui a2ui generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist
```

然后基于这些产物生成 prompt：

```bash
npx @lynx-js/genui a2ui generate prompt \
  --catalog-dir dist \
  --catalog-id https://example.com/catalogs/custom/v1/catalog.json \
  --out dist/a2ui-system-prompt.txt
```

`--catalog-dir` 必须指向生成后的 catalog 根目录。prompt 生成器会优先读取完整 catalog 文件，例如 `dist/catalog.json`；如果不存在，再回退到 `catalog/<Component>/catalog.json`。

安装 `@lynx-js/genui` 后，包内也会暴露同样的 `genui` 命令。因此项目脚本里可以使用 `genui a2ui ...`。已有的 A2UI-only 脚本也可以继续使用 `a2ui-cli` 兼容别名。

## 2. 程序化用法

当后端需要在 Node.js 代码中构建 prompt 时，可以使用 `@lynx-js/genui/a2ui-prompt`。

构建默认 prompt：

```ts
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const systemPrompt = buildA2UISystemPrompt();
```

追加请求级或部署级指令：

```ts
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const systemPrompt = buildA2UISystemPrompt({
  appendix: [
    'Prefer concise mobile-first layouts.',
    'When the user asks for charts, use LineChart only when numeric series are available.',
  ].join('\n'),
});
```

读取已生成的自定义 catalog，并为它构建 prompt：

```ts
import {
  buildA2UISystemPrompt,
  readA2UICatalogFromDirectory,
} from '@lynx-js/genui/a2ui-prompt';

const catalog = readA2UICatalogFromDirectory({
  catalogDir: 'dist/catalog',
  catalogId: 'https://example.com/catalogs/custom/v1/catalog.json',
  label: 'Example app catalog',
  version: 'v1',
});

const systemPrompt = buildA2UISystemPrompt({ catalog });
```

如果 catalog 已经在内存中，可以使用 `createA2UICatalogFromManifests(...)` 传入组件 JSON Schema 和可选函数定义，构建出 `A2UICatalog` 后再交给 `buildA2UISystemPrompt`。

## 生成内容

生成的 prompt 会包含：

- A2UI v0.9 协议概览和设计原则。
- 必需的服务端到客户端消息类型：`createSurface`、`updateComponents`、`updateDataModel` 和 `deleteSurface`。
- 新 UI 响应的消息顺序要求。
- `{ "path": "/..." }` 数据绑定和列表 children 的规则。
- 客户端 action、event 和 function call 的规则。
- catalog reference：组件摘要、props、必填字段、容器形态、枚举值和函数签名。
- 硬性规则：只能输出 JSON、catalog id 必须匹配、组件树必须扁平、必须有 `root` 组件、Button 标签和 action 规则、Modal 确认流程、图片查询处理，以及 action response 的 patch 规则。
- catalog 提供的已验证示例。
- CLI 或程序化 API 传入的可选 appendix。

模型应该返回 A2UI 消息组成的 JSON 数组，而不是 Markdown 或自然语言说明：

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "main",
      "catalogId": "https://a2ui.org/specification/v0_9/basic_catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Text",
          "text": "Hello A2UI"
        }
      ]
    }
  }
]
```

## 后端接入示例

只要模型服务支持 system message，就可以使用生成的 prompt。后端应当先发送 system prompt，再发送用户消息，然后解析或流式转发模型输出的 A2UI JSON。

```ts
import OpenAI from 'openai';
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const systemPrompt = buildA2UISystemPrompt();

export async function POST(req: Request) {
  const { messages } = await req.json();
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'your-model',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  return new Response(completion.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

如果后端支持 A2UI 交互 action，需要保留会话历史，并把客户端 action 消息继续传回模型。action response 应该针对已有 surface 输出 `updateDataModel` 和/或 `updateComponents`，而不是重新创建一个新 surface。

## 如何选择

适合使用 CLI 的场景：

- catalog 在构建时确定。
- 后端可以读取一份已提交或已生成的 prompt 文件。
- 多个服务需要共享完全一致的 prompt 文本。

适合程序化生成的场景：

- catalog、appendix 或安全策略会按环境或请求变化。
- 后端本来就会加载生成后的 catalog 产物。
- 需要在代码里组合自定义 `A2UICatalog`。

自定义 renderer catalog 和 manifest 生成流程可继续阅读 [Catalogs and manifests](./catalog-guide_zh.md)。
