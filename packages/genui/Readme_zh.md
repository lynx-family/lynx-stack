# Lynx GenUI

Lynx GenUI 面向已经熟悉 React 的开发者：你继续写可信的 ReactLynx 组件，AI 只负责从这些组件中选择、组合，并生成 Lynx
原生界面。

如果你第一次听说 A2UI，可以先这样理解：

- 在 React 里，是你的代码选择组件并传入 props。
- 在 GenUI 里，是 Agent 从你发布的组件 Catalog 中选择组件。
- Client 仍然渲染真实的 ReactLynx 组件。模型只发送数据，告诉渲染器用哪个已授权组件、传哪些 props。

A2UI 是中间的消息协议。它不是 React 的替代品，也不是新的样式系统。它只是用安全的 JSON 数据表达：创建一个 surface、渲染这些组件、更新这些数据、把这个用户操作回传给 Agent。

## 为什么需要它

生成式 UI 只有在有产品约束时才真正可用：

- Agent 只能使用你的应用注册过的组件。
- 组件 props 由 TypeScript 契约生成 schema。
- 模型输出会先经过校验，再交给 Client 渲染。
- UI 可以渐进式流式生成，而不是等一个巨大响应结束。
- 用户操作会以结构化事件回传，类似跨网络边界的 React event handler。

最终产物不是任意生成代码，而是由可信 Catalog 组装出的 ReactLynx UI 树。

## 从 React 过渡到 GenUI

这是 React 心智模型：

```tsx
function WeatherCard(props: WeatherCardProps) {
  return (
    <Card>
      <Text>{props.city}</Text>
      <Text>{props.temperature}</Text>
      <Button onClick={props.onRefresh}>Refresh</Button>
    </Card>
  );
}
```

这是 GenUI 心智模型：

1. 你把 `Card`、`Text`、`Button` 以及自定义组件发布到 Catalog。
2. Agent 收到用户请求和 Catalog 描述。
3. Agent 输出 A2UI 消息，例如“渲染一个 Card，并带有这些子节点”。
4. Client 把这些消息写入 `MessageStore`。
5. `<A2UI>` 渲染对应的 ReactLynx 组件。
6. 用户点击生成出来的按钮时，`onAction` 触发，应用把 action 发回 Agent。

模型不会 import 你的代码。它只能命名渲染器已经授权的组件。

## 目录结构

| Package                  | 作用                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `a2ui`                   | `@lynx-js/a2ui-reactlynx`，面向 A2UI v0.9 的 ReactLynx 渲染器，提供 `<A2UI>`、`MessageStore`、Catalog API、内置组件和协议辅助能力。 |
| `a2ui-catalog-extractor` | 基于 TypeDoc 的 CLI，可将带有 `@a2uiCatalog` 标记的 TypeScript interface 转换成 `catalog.json` schema。                             |
| `server`                 | Next.js Agent 服务，构建 A2UI prompt，请求 OpenAI 兼容模型，校验输出，自动修复异常响应，解析图片查询，并暴露 chat/action API。      |
| `a2ui-playground`        | 用于浏览器和 Lynx 预览的实验台，支持 demo、组件浏览、AI 对话生成、回放、action 流程和二维码原生预览。                               |
| `openui`                 | 基于 `@openuidev/lang-core` 的 OpenUI 语言实验渲染器和 Catalog 桥接层。                                                             |
| `ui-judge`               | 基于 Playwright 和 Midscene 的生成式 UI 评估工具，输出 `visual-correctness` 分数。                                                  |

## 三个核心部分

```text
Catalog：什么能被渲染
  -> Agent：应该渲染什么
  -> Client：渲染它，并把操作发回去
```

### Catalog

对 React 开发者来说，Catalog 就是“暴露给 AI 的公开组件 API”。它相当于导出组件以及它的 props 类型。

Catalog 告诉 Agent：

- 组件名，例如 `Text`、`Column`、`ProductTile`。
- props 名称和类型。
- 哪些字段必填。
- enum 字段允许哪些值。
- 动态格式化和校验里可以调用哪些函数。

Catalog 告诉 Client：

- 每个 A2UI 组件名对应哪个 ReactLynx 组件。
- 哪些组件名可以安全渲染。

### Agent

Agent 是 UI 规划器。它接收普通 chat messages，读取 Catalog，然后返回 A2UI JSON 消息。内置 server 会在把消息交给 Client
之前先做校验。

关键产品规则是：Agent 必须在你的 Catalog 里做设计。Catalog 里没有的组件，不应该出现在生成 UI 中。

### Client

Client 负责传输和渲染。它从 Agent 获取消息，把消息写入 `MessageStore`，渲染 `<A2UI>`，并把生成 UI 中的用户操作转发给 server。

如果你了解 `useSyncExternalStore`，`MessageStore` 会很容易理解：它是一个只追加的外部 store，保存协议消息。`<A2UI>`
订阅它，并在新消息到达时更新界面。

## 快速开始

以下命令从仓库根目录执行。新工作区请先安装依赖：

```sh
corepack enable
pnpm install --frozen-lockfile
```

构建核心 GenUI 包：

```sh
pnpm turbo build --filter @lynx-js/a2ui-catalog-extractor --filter @lynx-js/a2ui-reactlynx
```

如果要获得完整测试信心，请遵循仓库规则：先运行根级 `pnpm turbo build`，再运行测试。

### 1. Catalog：把 React 组件变成 Agent 可见的组件

先从组件契约开始。这正是 React 开发者已经熟悉的部分：命名 props，并让组件行为保持可预测。

```tsx
/**
 * Product tile for commerce recommendations.
 *
 * @a2uiCatalog ProductTile
 */
export interface ProductTileProps {
  /** Product name shown as the title. */
  title: string;
  /** Price text already localized by the caller. */
  price: string;
  /** Image search query or resolved URL. */
  imageUrl?: string;
}

export function ProductTile(props: ProductTileProps) {
  return (
    <view className='product-tile'>
      {props.imageUrl ? <image src={props.imageUrl} /> : null}
      <text>{props.title}</text>
      <text>{props.price}</text>
    </view>
  );
}

ProductTile.displayName = 'ProductTile';
```

为 Agent 生成 schema：

```sh
pnpm exec a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog
```

然后把组件和 manifest 配对：

```tsx
import {
  Button,
  Column,
  Text,
  createMessageStore,
  defineCatalog,
  serializeCatalog,
} from '@lynx-js/a2ui-reactlynx';
import buttonManifest from '@lynx-js/a2ui-reactlynx/catalog/Button/catalog.json'
  with { type: 'json' };
import columnManifest from '@lynx-js/a2ui-reactlynx/catalog/Column/catalog.json'
  with { type: 'json' };
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json'
  with { type: 'json' };
import productTileManifest from './dist/catalog/ProductTile/catalog.json'
  with { type: 'json' };

export const uiCatalog = defineCatalog([
  [Text, textManifest],
  [Column, columnManifest],
  [Button, buttonManifest],
  [ProductTile, productTileManifest],
]);

export const catalogHandshake = serializeCatalog(uiCatalog);
export const store = createMessageStore();
```

当你自己的传输层或 Agent 消费客户端握手形状时，可以使用 `catalogHandshake`。当前内置 server 会从
`server/agent/a2ui-catalog.ts` 里的 `A2UICatalog` 形状构建 prompt，因此如果要把自定义 client catalog
传给该服务，需要显式转换层，或者扩展 server 侧 Catalog。

包里故意没有导出 “all built-ins” 常量。一次性引入所有组件会让包体成本不可见，也会削弱 tree-shaking。确实需要全量内置组件时，可以参考
[`a2ui/src/catalog/README.md`](./a2ui/src/catalog/README.md) 里的可复制配方。

生产环境注意：压缩工具可能改写函数名。请设置 `ProductTile.displayName = 'ProductTile'`，或将自定义组件与 manifest
配对，确保协议里的组件名稳定。

### 2. Agent：描述 UI，收到已校验消息

启动本地 Agent 服务：

```sh
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini
pnpm --filter a2ui-server dev
```

检查配置：

```sh
curl http://localhost:3060/a2ui/health
```

向 Agent 请求 UI：

```sh
curl http://localhost:3060/a2ui/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Create a compact weather card with a photo, temperature, humidity, and a Refresh button."
      }
    ]
  }'
```

响应里会包含 `messages`。这些不是 React elements，而是 Client 渲染器可以处理的数据指令。

一个极简 A2UI 响应长这样：

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
          "component": "Column",
          "children": ["title"]
        },
        {
          "id": "title",
          "component": "Text",
          "text": "Hello from generated UI"
        }
      ]
    }
  }
]
```

正常开发时不需要手写这些 JSON。理解这个形状主要是为了方便调试。

主要接口：

| Endpoint                   | 用途                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `GET /a2ui/health`         | 检查模型供应商配置和当前模型。                                      |
| `POST /a2ui/chat`          | 返回一次已校验的 JSON 响应。                                        |
| `POST /a2ui/stream`        | 通过 SSE 流式返回模型 delta，并在最终 `done` 事件里给出已校验消息。 |
| `POST /a2ui/action`        | 将 Client action 转换成下一轮已校验的 A2UI 响应。                   |
| `POST /a2ui/action/stream` | 流式返回 action 响应和最终校验结果。                                |

常用环境变量：

| Variable                     | 作用                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `OPENAI_API_KEY`             | 必填的模型凭证。                                                           |
| `OPENAI_MODEL`               | 模型 id，默认 `gpt-4o-mini`。                                              |
| `OPENAI_BASE_URL`            | 可选的 OpenAI 兼容 endpoint。                                              |
| `OPENAI_API_STYLE`           | `responses` 或 `chat`；官方 OpenAI endpoint 默认使用 `responses`。         |
| `PEXELS_API_KEY`             | 可选图片搜索供应商；未配置时会回退到确定性的 Picsum URL。                  |
| `A2UI_CORS_ORIGINS`          | 额外允许的浏览器来源，多个来源用逗号分隔。                                 |
| `A2UI_RATE_LIMIT_PER_MIN`    | 单客户端每分钟请求限制，默认 `20`。                                        |
| `A2UI_ALLOW_CLIENT_OVERRIDE` | 仅建议可信本地实验设置为 `1`，允许浏览器传入 API key、base URL 或模型 id。 |

### 3. Client：像处理 React 状态一样渲染消息

Client 获取 Agent 输出，并把每条消息写入 store。`<A2UI>` 负责处理协议并渲染对应的 ReactLynx 组件。

```tsx
import {
  A2UI,
  Button,
  Column,
  Text,
  createMessageStore,
} from '@lynx-js/a2ui-reactlynx';
import type { UserActionPayload } from '@lynx-js/a2ui-reactlynx';

const store = createMessageStore();
const catalogs = [Text, Column, Button];

async function sendPrompt(content: string) {
  const response = await fetch('http://localhost:3060/a2ui/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content }],
    }),
  });
  const body = await response.json();
  for (const message of body.messages ?? []) {
    store.push(message);
  }
}

async function sendAction(action: UserActionPayload) {
  const response = await fetch('http://localhost:3060/a2ui/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surfaceId: action.surfaceId,
      action,
    }),
  });
  const body = await response.json();
  for (const message of body.messages ?? []) {
    store.push(message);
  }
}

export function GeneratedUIScreen(): import('@lynx-js/react').ReactNode {
  return (
    <A2UI
      messageStore={store}
      catalogs={catalogs}
      onAction={(action) => {
        void sendAction(action);
      }}
      wrapSurface={(children) => <view className='a2ui-light'>{children}</view>}
    />
  );
}
```

把它映射回 React：

- `MessageStore` 是外部状态源。
- `store.push(message)` 类似从 server 收到下一次状态更新。
- `catalogs` 是生成树允许使用的组件白名单。
- `onAction` 类似 event handler，只是事件会被序列化并发回 Agent。
- 给 `<A2UI>` 传入新的 React `key` 可以开启一个全新的渲染会话。

## 传输层实现

GenUI 不限定传输方式。协议消息可以通过 REST、SSE、WebSocket、A2A、AG UI、MCP，或者进程内 mock 传递。在 React
应用里，传输层是你的产品状态和 `MessageStore` 之间的适配层。

它负责：

- 调用 Agent endpoint。
- 传递 conversation history 和 data-model snapshot。
- 解析 JSON 或流式 SSE 响应。
- 按顺序把已校验 A2UI 消息写入 store。
- 将 `onAction` payload 转发回 Agent。
- 取消已失效的请求，并向 UI 返回可展示的错误状态。

不要让传输层负责：

- 直接渲染 A2UI 组件。
- 手动修改生成出来的组件树。
- 把未经校验的模型文本当成 UI。
- 在生产环境允许浏览器覆盖模型供应商凭证。

### 接口设计最佳实践

让传输层保持小而明确：

```ts
import type { MessageStore, UserActionPayload } from '@lynx-js/a2ui-reactlynx';

interface ConversationContext {
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  dataModel: Record<string, unknown>;
}

interface A2UITransport {
  generate(input: {
    prompt: string;
    conversation?: ConversationContext;
    signal?: AbortSignal;
  }): Promise<unknown[]>;
  respondToAction(input: {
    surfaceId: string;
    action: UserActionPayload;
    conversation?: ConversationContext;
    signal?: AbortSignal;
  }): Promise<unknown[]>;
}

async function applyMessages(
  store: MessageStore,
  messages: unknown[],
): Promise<void> {
  for (const message of messages) {
    store.push(message);
  }
}
```

这样生成 UI 在最后一步之前始终是数据。只有渲染器负责解释 A2UI 消息。

### REST 基线实现

如果只需要简单的 request/response，可以使用 `/a2ui/chat` 和 `/a2ui/action`：

```ts
function extractMessages(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'string') {
    try {
      return extractMessages(JSON.parse(payload));
    } catch {
      return [];
    }
  }
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as {
    messages?: unknown;
    validation?: { messages?: unknown };
    text?: unknown;
  };
  if (Array.isArray(record.messages)) return record.messages;
  if (Array.isArray(record.validation?.messages)) {
    return record.validation.messages;
  }
  if (typeof record.text === 'string') return extractMessages(record.text);
  return [];
}

async function postA2UI(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`A2UI request failed: ${response.status}`);
  }

  const messages = extractMessages(payload);
  if (messages.length === 0) {
    throw new Error('A2UI response did not include renderable messages');
  }
  return messages;
}
```

接入渲染器：

```ts
async function generate(prompt: string, signal?: AbortSignal) {
  const messages = await postA2UI(
    'http://localhost:3060/a2ui/chat',
    { messages: [{ role: 'user', content: prompt }] },
    signal,
  );
  await applyMessages(store, messages);
}

async function respondToAction(
  action: UserActionPayload,
  signal?: AbortSignal,
) {
  const messages = await postA2UI(
    'http://localhost:3060/a2ui/action',
    { surfaceId: action.surfaceId, action },
    signal,
  );
  await applyMessages(store, messages);
}
```

### SSE 流式实现

如果希望展示生成进度，可以使用 `/a2ui/stream` 和 `/a2ui/action/stream`。server 会发出：

- `delta`：模型原始文本，适合给 inspector 或 loading state 使用。
- `repair`：可选元数据，表示 server 曾尝试修复无效模型输出。
- `done`：最终校验后的 payload。渲染时应使用这个事件中的 messages。
- `error`：结构化错误 payload。

```ts
interface SseFrame {
  event: string;
  data: unknown;
}

function parseSseFrame(frame: string): SseFrame | null {
  const lines = frame.split(/\r?\n/u);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

async function readA2UISse(
  response: Response,
  onDelta?: (text: string) => void,
): Promise<unknown[]> {
  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = '';
  let generatedText = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/u);
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === 'delta') {
        const text = (parsed.data as { text?: unknown }).text;
        if (typeof text === 'string') {
          generatedText += text;
          onDelta?.(generatedText);
        }
        continue;
      }

      if (parsed.event === 'done') {
        const messages = extractMessages(parsed.data);
        if (messages.length === 0) {
          throw new Error('A2UI stream finished without renderable messages');
        }
        return messages;
      }

      if (parsed.event === 'error') {
        throw new Error(JSON.stringify(parsed.data));
      }
    }

    if (done) break;
  }

  return extractMessages(generatedText);
}
```

不要默认把每个 `delta` 都当成 A2UI 渲染。流式过程中模型文本经常是不完整 JSON 数组。默认应该从最终 `done`
事件渲染。如果你选择部分渲染，只发布已经完整解析出的 message object，并在 `done` 到达后用最终已校验 messages 覆盖。

## 传输层实现注意事项

- 每个 conversation surface 保持一个活跃生成请求。新 prompt 开始时，取消或忽略旧请求。
- 用户 action 使用单独的 `AbortController`。旧的 action response 不应该在新 action 开始后继续更新 UI。
- 从 `done.validation.messages` 或 `messages` 渲染最终结果。`delta` 只用于进度展示和调试。
- 按 server 顺序写入 `MessageStore`。除非你非常理解协议后果，否则不要排序、合并或去重。
- 将 conversation history 和当前 data-model snapshot 保存在 `MessageStore` 之外；需要连贯多轮更新时，在下一次 Agent 请求中带上它们。
- action 请求要同时携带 `surfaceId` 和完整 `action` payload。action response 通常更新已有 surface，而不是创建新 surface。
- 统一处理支持的响应格式：直接数组、`{ messages }`、`{ validation: { messages } }`、以及字符串化 JSON。
- 检查 `content-type`。内置 endpoint 可能根据 route 返回 JSON 或 `text/event-stream`。
- 非 2xx 响应优先按结构化 JSON 解析错误，再回退到基于 status 的错误。
- endpoint 白名单要严格。Playground 只信任同源、托管 GenUI server，以及本地开发 endpoint。
- 生产环境不要让浏览器传入模型 API key、base URL 或 model id。`A2UI_ALLOW_CLIENT_OVERRIDE=1` 只适合可信本地实验。
- 对浏览器暴露 Agent 前，先配置好 CORS 和 rate limit。
- 为 Catalog 契约做版本管理。Agent Catalog 和 Client Catalog 必须在组件名与 props 上一致，否则已校验输出在 Client 侧仍可能变成 unsupported。
- 测试里优先使用确定性的 mock。传输层可以是进程内 async generator，把固定 A2UI messages 写入 store。

常见错误：

- 渲染未经校验的模型文本，而不是已校验 A2UI messages。
- 对无关 conversation 复用同一个 `MessageStore`，但没有通过 `<A2UI key={...}>` 重新挂载。
- 丢失 `conversation.dataModel`，导致后续 action 失去状态上下文。
- 自动重试非幂等 action，导致同一个用户意图被执行两次。
- 允许不可信浏览器输入控制图片 URL、远端 endpoint 或模型供应商配置覆盖。

## 体验 Playground

在接入应用前，Playground 是理解完整链路最快的入口：

```sh
pnpm --filter a2ui-server dev
pnpm --filter a2ui-playground dev
```

打开 `http://localhost:3000`。本地开发时，Playground 会自动寻找 `http://localhost:3060/a2ui/stream`。也可以显式传入可信 endpoint：

```text
http://localhost:3000/?a2uiEndpoint=http://localhost:3060/a2ui/stream
```

你可以在 Playground 中：

- 用自然语言描述 UI，并查看生成出的 A2UI JSON。
- 像浏览 React 组件库一样浏览组件 Catalog。
- 预览生成出的 Lynx 界面。
- 测试 submit、refresh、selection 等 action 流程。
- 生成预览链接和二维码，用于 Lynx 原生调试。

## 给 React 开发者的术语表

| GenUI 术语         | React 视角下的含义                                               |
| ------------------ | ---------------------------------------------------------------- |
| A2UI               | 描述 UI 变化的 JSON 消息，类似受约束、可序列化的 UI tree。       |
| Surface            | 生成式 UI 的根节点，类似一个被挂载的应用区域。                   |
| Catalog            | 暴露给 Agent 的组件白名单和 props schema。                       |
| `MessageStore`     | 只追加的外部 store，用来接收协议消息。                           |
| `updateComponents` | “用这些 props 渲染这些组件实例”。                                |
| `updateDataModel`  | “更新绑定 props 使用的数据”，类似远端状态更新。                  |
| Action             | 生成 UI 中的事件，类似 `onClick`，会作为结构化数据发回给 Agent。 |

## 协议要点

当前 A2UI 路径基于 A2UI v0.9。

- 模型必须输出原始 JSON 数组，而不是 Markdown。
- 全新响应以 `createSurface` 开始，随后是包含 `root` 组件的 `updateComponents`。
- 组件是扁平图结构，子节点通过 id 引用，不能内联。
- 数据绑定使用 JSON Pointer，并且必须由 `updateDataModel` 填充。
- 可交互组件会发出 action payload。Client 将 action 发送给 Agent，Agent 再返回同一个 surface 的更新消息。

## 测试与质量

聚焦检查：

```sh
pnpm --filter @lynx-js/a2ui-reactlynx test
pnpm --filter @lynx-js/a2ui-catalog-extractor test
pnpm --filter @lynx-js/ui-judge test
```

`@lynx-js/ui-judge` 使用 Playwright 和 Midscene。只有在配置了 `MIDSCENE_MODEL_NAME` 等 Midscene 模型环境变量时，才会运行依赖模型的测试。

广泛测试前请遵循仓库规则：

```sh
pnpm turbo build
pnpm test
```

## 产品方向

GenUI 围绕几个原则演进：

- React 仍然是实现层。Agent 只从你拥有的组件里选择。
- Catalog 是产品契约，用来让生成 UI 对齐设计系统和平台约束。
- 渐进式渲染应该让用户在完整响应结束前已经看到有价值的界面。
- 传输层可以替换。REST、SSE、WebSocket、A2A、AG UI 或 MCP 都可以承载同样的 A2UI 消息。
- 生成式 UI 应该能被检查、回放，并进入自动化评估流程。

更多实现细节可以从这些包级文档开始：
[`a2ui`](./a2ui/README.md)、[`a2ui-catalog-extractor`](./a2ui-catalog-extractor/README.md)
和 [`ui-judge`](./ui-judge/README.md)。
