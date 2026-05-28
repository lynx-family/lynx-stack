# 架构和 exports

这篇文档面向已经完成 quick start、并希望理解 A2UI stack 各部分职责边界的
开发者。

## 职责划分

| 部分           | 运行位置                  | 职责                                                                                                                                                                  |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent 服务     | Server                    | 把用户 prompt 和客户端 action 转换成经过校验的 A2UI message 数组。它应该使用与客户端可渲染能力一致的 catalog contract 来提示模型。                                    |
| 传输适配层     | Client shell              | 通过 REST、SSE、WebSocket 或其他传输方式把 prompt/action 发给 Agent 服务，再把返回的 messages 写入 `MessageStore`。                                                   |
| `MessageStore` | Client                    | 按到达顺序保存原始 A2UI protocol messages，并通知订阅者。它不解析也不解释协议语义。                                                                                   |
| `<A2UI>`       | Client                    | 每次 mount 拥有一个 `MessageProcessor`，从 `MessageStore` 消费新 messages，渲染当前 active surface，并通过 `onAction` 把 generated UI action 转发出去。               |
| Catalog API    | Client 和 Agent handshake | 把协议中的 component/function 名称映射到本地实现和可选 JSON schema。使用 `defineCatalog`、`mergeCatalogs`、`serializeCatalog` 和 `defineFunction` 组合这份 contract。 |
| 内置能力       | Client                    | 提供 A2UI v0.9 basic catalog 的组件 renderer、JSON-Schema manifest，以及客户端 basic-catalog function 实现。                                                          |
| `genui a2ui`   | 构建/接入阶段             | 生成自定义 catalog artifacts 和 system prompt。如果 Agent 和 renderer 都使用内置 basic catalog，则不需要它。                                                          |

## 包含内容

- `<A2UI>`：all-in-one 组件。它拥有 `MessageProcessor`，订阅开发者传入的
  `MessageStore`，并渲染最新的 surface。
- `MessageStore`：原始 protocol messages 的 append-only buffer。开发者可以从
  fetch、SSE、WebSocket、in-process mock 等任意 IO 传输层写入 messages。
- `defineCatalog`、`mergeCatalogs`、`serializeCatalog` 和 `defineFunction`：
  catalog API。这里没有全局 component catalog；每个消费者都要显式组合自己
  想开放的 component 和 function entries。
- `catalog/<Name>`：内置组件 renderers（`Text`、`Image`、`Row`、`Column`、
  `List`、`Card`、`Modal`、`Button`、`Divider`、`Icon`、`CheckBox`、
  `ChoicePicker`、`DateTimeInput`、`LineChart`、`PieChart`、`RadioGroup`、
  `Slider`、`TextField` 和 `Tabs`）。
- `catalog/<Name>/catalog.json`：用于 Agent handshake 的逐组件 JSON-Schema
  manifests。
- `basicFunctions`：A2UI v0.9 basic-catalog 的客户端 function entries，可以
  直接展开到 `catalogs` 中。

## Exports

- `@lynx-js/genui/a2ui`：`<A2UI>`、`createMessageStore`、
  `defineCatalog`、内置组件、basic functions 和 protocol types。
- `@lynx-js/genui/a2ui/catalog`：catalog API 和内置组件的 re-export，
  适合 tree-shake-friendly 的 subpath 访问。
- `@lynx-js/genui/a2ui/catalog/<Name>`：导入单个内置组件。
- `@lynx-js/genui/a2ui/catalog/<Name>/catalog.json`：导入单个组件的
  manifest。
- `@lynx-js/genui/a2ui/store`：`MessageStore`、`MessageProcessor`、
  `Resource`、payload normalizers 等纯数据层能力。
- `@lynx-js/genui/a2ui/react`：自定义 catalog 组件会用到的 helper，包括
  `NodeRenderer`、`useAction`、`useDataBinding` 和 `useChecks`。
- `@lynx-js/genui/a2ui/functions`：basic-catalog function entries 和注册
  helper。
- `@lynx-js/genui/a2ui/styles/theme.css`：可选的默认 CSS tokens，提供
  `.a2ui-light` 和 `.a2ui-dark`。

## `<A2UI>` 生命周期说明

- 每次 mount 都拥有自己的 `MessageProcessor`。传入另一个 `messageStore` 实例
  不会重置内部状态；如果你想开启新的 session/turn，请使用由 turn/session id
  派生出的 `key`。
- `onAction` 是 fire-and-forget。renderer 不等待响应；你的 Agent 把后续
  messages 写回同一个 `MessageStore`。
- `className` 会加在 surface root view（`surface-${surfaceId}`）上。
- `wrapSurface` 会在渲染出的 surface 外面包一层。
- 两者都可以用于多主题切换；选择与你的样式策略匹配的那一层。
