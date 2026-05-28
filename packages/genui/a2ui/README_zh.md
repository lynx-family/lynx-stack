# @lynx-js/genui/a2ui

[English](./README.md) | 简体中文

`@lynx-js/genui/a2ui` 是面向 A2UI v0.9 的 ReactLynx 客户端运行时。它消费经过校验的
A2UI server-to-client JSON messages，并在你的应用中渲染可信的 ReactLynx 组件。

当你已经有、或准备构建一个返回 A2UI messages 的 Agent 服务时，使用这个包。它不托管 Agent，不调用
LLM，不拥有后端路由，也不提供 chat shell。你的应用负责传输层，并把消息写入 renderer。

如果你第一次接触 A2UI，可以先这样理解：

- 在 React 里，是你的代码选择组件并传入 props。
- 在 A2UI 里，是 Agent 从你的应用发布的组件 Catalog 中选择组件。
- Client 仍然渲染真实的 ReactLynx 组件。模型只发送数据，告诉渲染器用哪个已授权组件、传哪些 props。

最终产物不是任意生成代码，而是由可信 Catalog 组装出的 ReactLynx UI 树。

## 安装

在 ReactLynx 应用中安装公开的 GenUI 包：

```sh
pnpm add @lynx-js/genui @lynx-js/react
```

如果想使用内置 light/dark CSS variables，可以在入口处引入一次可选的默认主题 tokens：

```ts
import '@lynx-js/genui/a2ui/styles/theme.css';
```

## 快速开始

创建 `MessageStore`，注册 generated UI 允许渲染的组件，并把 generated actions 转发回你的 Agent 服务。

```tsx
import {
  A2UI,
  Button,
  Text,
  basicFunctions,
  createMessageStore,
  normalizePayloadToMessages,
} from '@lynx-js/genui/a2ui';

const store = createMessageStore();
const catalogs = [Text, Button, ...basicFunctions];

async function sendPrompt(input: string) {
  const res = await fetch('/a2ui/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: input }] }),
  });

  store.push(normalizePayloadToMessages(await res.json()));
}

<A2UI
  messageStore={store}
  catalogs={catalogs}
  wrapSurface={(children) => <view className='a2ui-light'>{children}</view>}
  onAction={(action) => {
    void fetch('/a2ui/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    })
      .then((res) => res.json())
      .then((payload) => store.push(normalizePayloadToMessages(payload)));
  }}
/>;
```

`MessageStore` 按到达顺序保存原始 protocol messages。`<A2UI>` 订阅它、处理新消息、渲染 active surface，并通过
`onAction` 抛出 generated UI actions。

## 你需要负责什么

| 部分                   | 负责人    | 作用                                                                                                    |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `@lynx-js/genui/a2ui`  | 这个包    | ReactLynx renderer、`MessageStore`、Catalog API、内置组件、协议辅助能力，以及 client function entries。 |
| `genui a2ui`           | GenUI CLI | 构建期命令，用来生成自定义 catalog artifacts 和 A2UI system prompts。                                   |
| 你的 Agent 服务        | 你的应用  | 接收用户 prompt/action，带着 A2UI prompt 和 catalog 调用模型，校验输出，然后返回 messages。             |
| 你的 transport adapter | 你的应用  | 调用 Agent 服务，处理 REST 或流式响应，把 messages 写入 `MessageStore`，并转发 generated UI actions。   |

## 首次接入要知道

- 只把 generated UI 允许使用的组件传给 `catalogs`。
- 当 messages 可能使用 `formatString`、`formatDate`、`required`、`email` 或 `and` 等 A2UI function calls 时，加入
  `...basicFunctions`。
- 需要通过 `serializeCatalog(...)` 把 JSON schemas 发送给 Agent 时，把组件和它的 `catalog.json` manifest 配对。
- 包里故意没有 `@lynx-js/genui/a2ui/catalog/all` 导出。请在接入点组合你真正需要的 catalog，让 bundle 成本保持可见。
- 新 turn 或新 session 需要重置 `<A2UI>` 时，传入不同的 `key`；组件会在一次 mount 生命周期内持有自己的
  `MessageProcessor`。

## 更多文档

- [架构与导出](./docs/architecture_zh.md)
- [Catalog 与 manifests](./docs/catalogs_zh.md)
- [自定义组件](./docs/custom-components_zh.md)
- [内置 Catalog 组合](./src/catalog/readme_zh.md)
- [打开 A2UI Playground](https://lynxjs.org/a2ui)
