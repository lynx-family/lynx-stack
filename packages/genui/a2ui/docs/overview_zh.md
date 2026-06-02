# 概览与架构

这篇文档解释 `@lynx-js/genui/a2ui` 是什么、它背后的心智模型，以及一条
server message 如何在 client 上变成渲染出来的 UI。它以一个可运行的
[quick start](#quick-start) 开场，然后逐步讲解架构，帮你理解 stack 各部分的
职责边界，以及这个包为什么设计成现在这样。

## 这个包是什么

`@lynx-js/genui/a2ui` 是面向 A2UI v0.9 协议的 ReactLynx **客户端运行时**。
它消费经过校验的 server-to-client JSON messages，并在你的应用中渲染可信的
ReactLynx 组件。

它刻意只做一件事——渲染。这个包**不会**：

- 托管 Agent，也不调用 LLM；
- 拥有后端路由或 chat shell；
- 决定_渲染什么_——那是 Agent 的职责。

你的应用负责传输层，并把 messages 写入 renderer。当你已经有、或准备构建一个
返回 A2UI messages 的 Agent 服务时，使用这个包。

## Quick start

在 ReactLynx 应用里安装这个包，然后用 `<A2UI>` 渲染一个 `MessageStore`。你的
传输层把 Agent 的 messages 写入 store；renderer 把它们变成 UI，并通过
`onAction` 把用户 action 交还给你。

```sh
pnpm add @lynx-js/genui @lynx-js/react
```

```tsx
import {
  A2UI,
  basicFunctions,
  Button,
  createMessageStore,
  normalizePayloadToMessages,
  Text,
} from '@lynx-js/genui/a2ui';

// 1. 一个 buffer，你的传输层把原始 protocol messages 写进它。
const store = createMessageStore();

// 2. 允许 generated UI 使用的 component 和 function。
const catalogs = [Text, Button, ...basicFunctions];

// 3. 发送 prompt，并把 Agent 的回复推进 store。
async function sendPrompt(input: string) {
  const res = await fetch('/a2ui/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: input }] }),
  });
  store.push(normalizePayloadToMessages(await res.json()));
}

// 4. 渲染。onAction 把用户点击回传给 Agent。
<A2UI
  messageStore={store}
  catalogs={catalogs}
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

这就是 client 的全部循环：**把 messages 推进来、渲染、把 actions 抛出去。**
传输层可以是 REST、SSE、WebSocket，或一个 in-process mock——renderer 并不关心。
本页接下来会讲清楚在 `store.push(...)` 和渲染出的 surface 之间到底发生了什么。
安装细节和可选的 theme tokens 见 [README](../README_zh.md)。

## 心智模型

如果你写过 React，这个转变很小但很关键：

- 在 **React** 里，是你的代码选择组件并传入 props。
- 在 **A2UI** 里，是 _Agent_ 从_你的应用_发布的组件 catalog 中选择组件，
  并发送数据，告诉渲染器用哪个已授权组件、传哪些 props。

模型从不发送可执行代码。它只是从你预先定义好的 contract 中选出一个
`component` 名称和一组 props。Client 在 catalog 里查到这个名称，渲染你注册的
真实 ReactLynx 组件。

```text
Agent output (data, not code):          Your catalog (code, trusted):
  { component: "Card",                     Card   -> <Card>   (you wrote this)
    child: "t1" }                          Text   -> <Text>   (you wrote this)
  { component: "Text", id: "t1",
    text: "Hello" }                      Result: <Card><Text>Hello</Text></Card>
```

最终产物不是任意生成的标记，而是由可信 catalog 组装出来的 ReactLynx UI 树——
这正是 generated UI 能安全地挂载到生产应用里的原因。Agent 只能触及你放进
catalog 的 component 和 function；它发出的其他任何东西都渲染为空。

## 端到端全貌

A2UI 是一次往返：server 负责决策，client 负责渲染。这个包就是下图 **Client**
框里的全部内容。

```text
       ┌─────────────── Your application ───────────────┐
user   │                                                │
input ─┼─► Transport ──prompt/action──► Agent service   │
       │   adapter                       (server)       │
       │      ▲                             │           │
       │      │      A2UI messages (JSON)   │           │
       │      └─────────────────────────────┘           │
       │      │                                          │
       │      ▼                                          │
       │   MessageStore ──► <A2UI> ──renders──► surface  │
       │   (raw buffer)     (this package)    (UI tree)  │
       │                       │                         │
       │                       └─ onAction ─► back to ───┤
       │                          (user taps)  transport │
       └────────────────────────────────────────────────┘
```

1. 用户输入 prompt，或在已渲染的 UI 上点击某处。
2. 你的 **transport adapter** 把它发给你的 **Agent 服务**。
3. Agent 带着 A2UI system prompt 和你的 catalog contract 调用模型，校验输出，
   然后返回 A2UI messages。
4. 你的 adapter 把这些 messages 写入 `MessageStore`。
5. `<A2UI>` 消费它们、渲染 active surface，并通过 `onAction` 把用户 action
   抛出——再回到第 2 步。

因为整个循环只是「把 messages 推进来、把 actions 抛出去」，传输层可以是 REST、
SSE、WebSocket，或一个 in-process mock。renderer 不关心 messages 是怎么来的。

## 谁负责什么

这个包在「它提供什么」和「你的应用提供什么」之间划了一条硬边界。保持这条边界
清晰，正是运行时保持传输无关、catalog 保持显式的原因。

| 部分              | 运行位置                 | 负责人    | 职责                                                                                                                       |
| ----------------- | ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| Agent 服务        | Server                   | 你的应用  | 把 prompt 和 client action 转成经过校验的 A2UI message 数组。使用与 client 可渲染能力一致的 catalog contract 提示模型。    |
| Transport adapter | Client shell             | 你的应用  | 通过 REST/SSE/WebSocket 把 prompt/action 发给 Agent，再把返回的 messages 写入 `MessageStore`。                             |
| `MessageStore`    | Client                   | 这个包    | 按到达顺序保存原始 A2UI messages 并通知订阅者。它不解析也不解释协议语义。                                                  |
| `<A2UI>`          | Client                   | 这个包    | 每次 mount 拥有一个 `MessageProcessor`，消费新 messages，渲染 active surface，并通过 `onAction` 转发 generated UI action。 |
| Catalog API       | Client + Agent handshake | 这个包    | 把协议中的 component/function 名称映射到本地实现和可选 JSON schema。用 `defineCatalog` 等组合它。                          |
| 内置能力          | Client                   | 这个包    | A2UI v0.9 basic-catalog 的组件 renderer、逐组件 JSON-Schema manifest，以及客户端 basic-catalog function 实现。             |
| `genui a2ui`      | 构建 / 接入阶段          | GenUI CLI | 生成自定义 catalog artifacts 和 A2UI system prompt。当 Agent 和 renderer 都用内置 basic catalog 时不需要它。               |

一个好记的方式：**server 决策，client 渲染，catalog 是两边达成一致的
contract。** catalog 是唯一同时活在 wire 两侧的部分——你的 client 注册实现，
你的 Agent 在 handshake 时收到序列化后的 schema。

## client 内部：一条 message 如何变成 UI

`<A2UI>` 是一个 all-in-one 的入口，但它底下其实是三个可独立组合的 layer。理解
一条 message 在它们之间走过的路径，能让 renderer 的行为——以及它的生命周期
坑——变得可预测。

```text
store.push(msg)
     │
     ▼
MessageStore ──subscribe──► <A2UI> ──► MessageProcessor ──► Surface(s)
(raw buffer)                 (React)    (state machine)      │   │
                                                     Resource│   │SignalStore
                                                  (pending/    (data model,
                                                   success/     signal-backed)
                                                   error)
                                                        │
                                                        ▼
                                              NodeRenderer walks the tree,
                                              looks each component up in the
                                              catalog, and renders it.
```

- **Store layer**（`@lynx-js/genui/a2ui/store`）——纯数据逻辑，没有 React。
  `MessageStore` 是一个 append-only buffer，带有对 `useSyncExternalStore`
  友好的 `subscribe` / `getSnapshot` API。你的传输层调用 `store.push(msg)`；
  store 刻意对协议语义保持「无知」。
- **`MessageProcessor`**——协议大脑。它拥有每一个 `Surface`，把
  `createSurface` / `updateComponents` / `updateDataModel` / `deleteSurface`
  应用进 surface 状态，并发出带类型的事件（`beginRendering`、`surfaceUpdate`、
  `deleteSurface`）供 React layer 消费。`dispatch({ userAction })` 把 action
  分发给监听者。
- **`Resource`**——一个 `pending → success → error` 状态机，每个 surface root
  和每个 component 实例各一个。它的 snapshot 引用在每次状态转换时都会改变，
  这样 `useSyncExternalStore` 永远不会在 `pending → error` 更新上「bail out」。
- **`SignalStore`**——一个 `@preact/signals` 封装，作为每个 surface 的 data
  model，用 JSON-pointer 风格的 path 寻址。
- **React layer**（`@lynx-js/genui/a2ui/react`）——`<A2UI>` 加上
  `NodeRenderer` 和那些把 surface 状态变成 ReactLynx 树的 hooks（`useAction`、
  `useDataBinding`、`useResolvedProps`、`useChecks`）。

有几个运行时行为值得了解，因为它们能解释你在开发中会看到的现象：

- **children 通过引用。** 一个 component 实例用 id 引用 children
  （`child: "text-1"` 或 `children: ["a", "b"]`）。catalog 组件通过对同一个
  surface 委托 `<NodeRenderer>` 来渲染它的 child id。
- **data binding。** 一个 bound prop 是 `{ path: string }`，它针对 surface 的
  `SignalStore` 求值。相对 path 针对组件的 `dataContextPath` 求值——这正是
  templates 和重复列表能工作的原因。
- **template 展开。** 当 `updateComponents` 带有「templated children」占位时，
  processor 会存下 `__template` 元数据。当之后的 `updateDataModel` 填充被绑定
  的 path 时，它会按每个 item 克隆 template 子树、重写 child id，并 scope 每个
  克隆的 `dataContextPath`。这就是为什么只改 data model 也能让组件出现或消失。
- **action 以 message 形式回流。** 一次点击调用 `sendAction`；`useAction` 解析
  所有动态值，构建一个 `UserActionPayload` 并 dispatch。`<A2UI>` 把它转发给你
  的 `onAction`。响应（如果有）会作为新的 protocol messages 回来，你把它们推回
  同一个 `MessageStore`。
- **未知 component 软失败。** 不在 catalog 里的 `component` 名称会按 tag 打印
  一次警告并渲染 `null`，而不是抛错。

## 包含内容

你会用来组合的构建块：

- **`<A2UI>`**——all-in-one 组件。它拥有 `MessageProcessor`，订阅开发者传入的
  `MessageStore`，并渲染最新的 surface。
- **`MessageStore`**——原始 protocol messages 的 append-only buffer。你可以从
  fetch、SSE、WebSocket 或 in-process mock 等任意传输层写入。
- **Catalog API**——`defineCatalog`、`mergeCatalogs`、`serializeCatalog`、
  `resolveCatalog` 和 `defineFunction`。这里没有全局 component registry；每个
  消费者都显式组合自己想开放的 component 和 function entries。
- **内置组件**——20 个 A2UI v0.9 basic-catalog renderer（`Text`、`Image`、
  `Button`、`Row`、`Column`、`List`、`Loading`、`Card`、`Modal`、`Divider`、
  `Icon`、`CheckBox`、`ChoicePicker`、`DateTimeInput`、`LineChart`、
  `PieChart`、`RadioGroup`、`Slider`、`TextField` 和 `Tabs`）。每个的用途见
  [catalog 指南](./catalog-guide_zh.md)。
- **逐组件 manifest**——`catalog/<Name>/catalog.json`，用于 Agent handshake 的
  JSON-Schema 描述。
- **`basicFunctions`**——A2UI v0.9 basic-catalog 的客户端 function entries，
  可以直接展开进你的 `catalogs` 数组。

## Exports

这个包按 subpath 拆分，让你只导入用到的部分。

| 导入                                              | 你得到什么                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@lynx-js/genui/a2ui`                             | 主入口：`<A2UI>`、`createMessageStore`、catalog API、所有内置组件、`basicFunctions`，以及 protocol types。 |
| `@lynx-js/genui/a2ui/catalog`                     | catalog API 和内置组件的再导出，作为 tree-shake-friendly 的 subpath。                                      |
| `@lynx-js/genui/a2ui/catalog/<Name>`              | 单个内置组件（例如 `.../catalog/Text`）。                                                                  |
| `@lynx-js/genui/a2ui/catalog/<Name>/catalog.json` | 该组件用于 handshake 的 JSON-Schema manifest。                                                             |
| `@lynx-js/genui/a2ui/store`                       | 纯数据层：`MessageStore`、`MessageProcessor`、`Resource`、`SignalStore`，以及 payload normalizers。        |
| `@lynx-js/genui/a2ui/react`                       | 自定义组件的 contract：`NodeRenderer`、`useAction`、`useDataBinding`、`useResolvedProps` 和 `useChecks`。  |
| `@lynx-js/genui/a2ui/functions`                   | `basicFunctions` 和 `registerBasicFunctions` 这个 escape hatch。                                           |
| `@lynx-js/genui/a2ui/styles/theme.css`            | 可选的默认 CSS tokens，提供 `.a2ui-light` 和 `.a2ui-dark`。                                                |

大多数应用只会从 `@lynx-js/genui/a2ui` 导入。当你构建自定义 catalog 组件或自己
的 renderer 时，才需要 `/store` 和 `/react`。

## `<A2UI>` props 与生命周期

`<A2UI>` 接收两个必填 prop 和一组可选的 render hooks。

| Prop                | 类型                                     | 必填 | 用途                                                                              |
| ------------------- | ---------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `messageStore`      | `MessageStore`                           | 是   | 你的传输层写入的 raw-message buffer。`<A2UI>` 订阅它并处理新的 tail messages。    |
| `catalogs`          | `readonly CatalogInput[]`                | 是   | renderer 被允许实例化的 component 和 function entries。                           |
| `onAction`          | `(action: UserActionPayload) => void`    | 否   | 树中发生用户 action 时触发。转发给你的 Agent；把响应推回 store。                  |
| `className`         | `string`                                 | 否   | 加在 surface root view（`surface-${surfaceId}`）上。适合做 surface 级主题 class。 |
| `wrapSurface`       | `(children, { surfaceId }) => ReactNode` | 否   | 包裹每个 surface，便于套一层外部主题壳或 wrapper 样式。                           |
| `renderEmpty`       | `() => ReactNode`                        | 否   | 在第一条 `beginRendering` 到达前渲染。默认什么都不渲染。                          |
| `renderFallback`    | `() => ReactNode`                        | 否   | 在 active resource 处于 pending 时渲染。默认是内置的 `<Loading>`。                |
| `renderError`       | `(err: unknown) => ReactNode`            | 否   | 在 active resource 失败时渲染。                                                   |
| `renderUnsupported` | `(info) => ReactNode`                    | 否   | 在遇到不支持的 component 或数据语法时渲染。                                       |

能省下调试时间的生命周期说明：

- **每次 mount 一个 processor。** `<A2UI>` 在每次 mount 时创建一次自己的
  `MessageProcessor`（surfaces、signals、resources）。之后传入_另一个_
  `messageStore` 实例**不会**重置内部状态。要开启新的 session 或 turn，请用一个
  由 turn/session id 派生的 `key` 来 mount：
  `<A2UI key={turnId} messageStore={turnStore} … />`。
- **`onAction` 是 fire-and-forget。** renderer 从不 await 它。你的 Agent 把后续
  messages 推回同一个 `MessageStore` 来更新 UI。
- **`className` vs `wrapSurface`。** 两者都能驱动主题切换；`className` 给 surface
  root 加样式，`wrapSurface` 在外面加一层 wrapper。选择与你的样式策略匹配的那层。

## 下一步

- [Catalogs、内置组件与自定义组件](./catalog-guide_zh.md)——组合 contract、加入
  manifest、注册你自己的组件。
- [打开 A2UI playground](https://lynxjs.org/a2ui)——在线体验。
