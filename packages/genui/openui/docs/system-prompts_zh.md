# System Prompts

生成和定制用于指导 LLM 输出合法 OpenUI Lang 的指令；这些输出必须与 ReactLynx
client 实际渲染的组件 Library 保持一致。

内置 Library 和静态 prompt 文件已经满足需求时使用 CLI；当 backend 需要组合
tools、feature flags、自定义组件或部署策略时，使用程序化 API。

## 必须保持的 contract

OpenUI system prompt 会描述：

- 每行一个 assignment 的语言语法；
- 必需的 `root` 入口和 top-down streaming 顺序；
- 从有序 Zod schemas 推导出的组件签名；
- 响应式 `$variables` 和 built-in functions；
- Query/Mutation 与 Action 规则；
- 传入时可用的工具名和 input/output schemas；
- 保证输出可解析的示例与硬性约束。

Prompt 侧 Library 与 client renderer Library 必须在每个组件名和位置 prop 顺序上
保持一致。如果两者发生漂移，模型可能为其中一侧生成合法、却被另一侧拒绝的文本。

## 1. CLI

把默认内置 OpenUI prompt 生成到文件：

```sh
npx @lynx-js/genui openui generate prompt \
  --out dist/openui-system-prompt.txt
```

输出到 stdout：

```sh
npx @lynx-js/genui openui generate prompt
```

追加部署侧规则：

```sh
npx @lynx-js/genui openui generate prompt \
  --appendix "Prefer compact mobile layouts for booking flows." \
  --out dist/openui-system-prompt.txt
```

CLI 使用内置 ReactLynx Library 的 headless 镜像。Prompt 生成命令支持：

| Option              | 用途                                      |
| ------------------- | ----------------------------------------- |
| `--out <file>`      | 写入文件而不是 stdout；父目录会自动创建。 |
| `--appendix <text>` | 追加应用侧特定指令。                      |
| `--version`         | 输出包版本。                              |
| `--help`            | 输出命令帮助。                            |

CLI 不会加载自定义组件目录或 tool manifest。当 Agent contract 包含自定义组件或
完整 tool schemas 时，请使用程序化 API。

## 2. 程序化用法

在 server-side TypeScript 中构建默认 prompt：

```ts
import { buildOpenUiSystemPrompt } from '@lynx-js/genui/openui/prompt';

const systemPrompt = buildOpenUiSystemPrompt();
```

加入应用策略和工具描述：

```ts
import { buildOpenUiSystemPrompt } from '@lynx-js/genui/openui/prompt';

const systemPrompt = buildOpenUiSystemPrompt({
  appendix: [
    'Prefer one-column mobile layouts.',
    'Never invent tool names or arguments.',
  ].join('\n'),
  promptOptions: {
    tools: [
      {
        name: 'list_orders',
        description: 'List orders filtered by status.',
        inputSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
          required: ['status'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            rows: { type: 'array', items: { type: 'object' } },
          },
          required: ['rows'],
        },
        annotations: { readOnlyHint: true },
      },
    ],
  },
});
```

Client 必须提供匹配的工具实现：

```tsx
<OpenUiRenderer
  response={response}
  library={library}
  toolProvider={{
    list_orders: async ({ status }) => {
      return await api.listOrders({ status: String(status) });
    },
  }}
/>;
```

Tool schemas 告诉模型可以调用什么；`toolProvider` 才是真正执行调用的代码。不要把
secrets 或 provider credentials 放进 prompt 或 browser-side tool arguments。

## Prompt options

`buildOpenUiSystemPrompt` 接受 Library options、prompt feature flags 和可选
appendix：

| Option                          | 用途                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `root`                          | 覆盖必需的 root component 名称；该组件必须同时存在于 prompt Library 和 client Library。 |
| `components`                    | 追加 headless component definitions；后加入的同名 definition 覆盖默认值。               |
| `componentGroups`               | 追加 prompt 分组 metadata。                                                             |
| `promptOptions.preamble`        | 替换或扩展语言规则前的产品 framing。                                                    |
| `promptOptions.additionalRules` | 在内置 mobile/OpenUI 约束后添加规则。                                                   |
| `promptOptions.examples`        | 替换默认静态示例。                                                                      |
| `promptOptions.toolExamples`    | 提供存在 tools 时使用的示例。                                                           |
| `promptOptions.tools`           | 通过名称或完整 schema 描述 Query/Mutation tools。                                       |
| `promptOptions.toolCalls`       | 启用或禁用 Query、Mutation、`@Run` 和 tool workflow 指令。                              |
| `promptOptions.bindings`        | 启用或禁用 `$variables`、`@Set`、`@Reset` 和响应式 filter 指令。                        |
| `promptOptions.editMode`        | 指导模型在增量编辑时只返回发生变化的 statements。                                       |
| `promptOptions.inlineMode`      | 允许自然语言和可选 fenced OpenUI，而不要求只输出原始 OpenUI。                           |
| `appendix`                      | 原样追加最终部署指令。                                                                  |

Lynx OpenUI prompt builder 默认启用 `bindings` 和 `toolCalls`。纯静态产品界面应
显式关闭：

```ts
const systemPrompt = buildOpenUiSystemPrompt({
  promptOptions: {
    bindings: false,
    toolCalls: false,
  },
});
```

`inlineMode` 默认关闭。在默认模式下，模型应只返回原始 OpenUI Lang，不要附加解释
或 Markdown code fence，这样完整 response 可以直接交给
`<OpenUiRenderer response={...}>`。

## 自定义组件 prompts

把共享 Zod schemas 放进框架无关模块。Client 用 ReactLynx `defineComponent`
包装 schema；server 使用 headless `@openuidev/lang-core` definition 包装同一份
schema。

```ts
// shared/bannerSchema.ts
import { z } from 'zod/v4';

export const bannerProps = z.object({
  title: z.string(),
  tone: z.enum(['info', 'success', 'warning']).optional(),
});
```

```tsx
// client/Banner.tsx
import { defineComponent } from '@lynx-js/genui/openui';
import { bannerProps } from '../shared/bannerSchema.js';

export const Banner = defineComponent({
  name: 'Banner',
  description: 'Compact status banner with a title and tone.',
  props: bannerProps,
  component: ({ props }) => (
    <view className={`Banner Banner-${props.tone ?? 'info'}`}>
      <text className='BannerTitle'>{props.title}</text>
    </view>
  ),
});
```

```ts
// server/openuiPrompt.ts
import { defineComponent } from '@openuidev/lang-core';
import { buildOpenUiSystemPrompt } from '@lynx-js/genui/openui/prompt';
import { bannerProps } from '../shared/bannerSchema.js';

const PromptBanner = defineComponent({
  name: 'Banner',
  description: 'Compact status banner with a title and tone.',
  props: bannerProps,
  component: () => null,
});

export const systemPrompt = buildOpenUiSystemPrompt({
  components: [PromptBanner],
  componentGroups: [
    { name: 'Product', components: ['Banner'] },
  ],
});
```

自定义 headless definitions 由 server workspace 维护时，请把
`@openuidev/lang-core` 和 `zod` 添加为直接 dependencies。让 prompt component
renderer 保持为 `() => null`，可以避免 server routes 导入 ReactLynx、Lynx UI
组件或 component CSS。

## 其他 prompt exports

`@lynx-js/genui/openui/prompt` 还导出：

| Export                               | 用途                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `createOpenUiPromptLibrary(options)` | 构建 headless 内置 Library，用于检查或底层 prompt 组合。          |
| `OPENUI_SYSTEM_PROMPT`               | 不带 options 创建的预构建默认 prompt。                            |
| `openUiPromptActionPropSchema`       | v0.5 action plans 与 legacy action objects 共用的 prompt schema。 |

应用代码优先使用 `buildOpenUiSystemPrompt()`，让定制项保持显式且可测试。

## Backend 接入模式

把 generated prompt 作为模型 system instruction 发送，保留原始文本流，再把它返回
给 client。Server 不必为了转发而解析 UI，但仍应执行自己的 model-output 和 tool
策略。

```ts
const systemPrompt = buildOpenUiSystemPrompt({
  promptOptions: { tools: toolSpecs },
  appendix: productPolicy,
});

const stream = await model.generate({
  system: systemPrompt,
  messages,
});

return streamOpenUiText(stream);
```

Client 侧把每个 delta 追加到同一个字符串，将累计值传给 `response`，并在 server
发出完成信号前保持 `isStreaming={true}`。新的 turn 开始前，用
`AbortController` 取消旧 generation。

当 `onError` 报告稳定 parser/runtime errors 时，应用可以把精简描述传回 Agent
做 correction。不要无限自动重试；应限制修正次数，并保留原始用户请求。

## 如何选择

适合使用 CLI 的场景：

- 内置 component contract 已经足够；
- 适合使用已提交或生成的静态 prompt 文件；
- 部署策略可以通过 appendix 表达。

适合使用程序化生成的场景：

- Tools 带有请求级或部署级 schemas；
- 不同产品使用不同 feature flags；
- Library 包含自定义或覆盖组件；
- 需要通过代码组合 examples、groups 或 policy。

Renderer 侧 contract 见
[Libraries、内置组件与自定义组件](./library-guide_zh.md)。
