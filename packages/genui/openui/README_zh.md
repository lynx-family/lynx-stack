# @lynx-js/genui/openui

[English](./README.md) | 简体中文

`@lynx-js/genui/openui` 是面向 OpenUI Lang v0.5 的 ReactLynx 客户端运行时。
它会解析声明式 OpenUI 文本、求值响应式状态和数据操作，并通过可信的
ReactLynx 组件 Library 渲染结果。

当 Agent 输出 OpenUI Lang，而你的 Lynx 应用负责传输、工具调用、状态持久化和
宿主 action 时，可以使用这个包。Agent 输出的是数据，而不是可执行 UI 代码；它
只能实例化你交给 renderer 的 Library 中声明过的组件。

如果你第一次接触 OpenUI，可以先这样理解：

- 在 React 里，是你的代码选择组件并传入 props。
- 在 OpenUI 里，是 Agent 使用你的 Library 中的组件，逐行写出 assignment。
- Client 解析这些 assignments，再渲染你注册的真实 ReactLynx 组件。

## 安装

在 ReactLynx 应用中安装公开的 GenUI 包：

```sh
pnpm add @lynx-js/genui @lynx-js/react @lynx-js/lynx-ui @lynx-js/luna-styles
```

默认 catalog 使用 `@lynx-js/lynx-ui` 的 headless 行为原语，并使用
`@lynx-js/luna-styles` 的语义化视觉 tokens。内置的 `Button`、`CheckBox`、
`Modal`、`RadioGroup`、`Slider` 和 `TextField` 使用 lynx-ui 原语。

先引入 Luna，再引入 OpenUI token 适配层，并在 renderer 外应用 Luna 主题
class。Renderer 和各组件的 CSS 会随对应模块自动引入，不需要额外导入
renderer 样式表。需要另一套配色时，也可以使用 Luna 提供的
`lunaris-light` 和 `lunaris-dark`。

```ts
import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';
```

## 快速开始

创建一个 Library，把原始 OpenUI Lang 传给 `<OpenUiRenderer>`，并处理需要宿主
应用接管的 actions。

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo } from '@lynx-js/react';

import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';

const response = String.raw`
root = Stack([header, card], "column", false, "m", "stretch", "start")
header = Text("Hello OpenUI", "h2")
card = Card([message, actions])
message = TextContent("This UI was described as data.")
actions = Buttons([Button("Continue", Action([@ToAssistant("Continue")]), "primary")])
`.trim();

export function GeneratedView() {
  const library = useMemo(() => createOpenUiLibrary(), []);

  return (
    <view className='luna-light'>
      <OpenUiRenderer
        response={response}
        library={library}
        onAction={(event) => {
          // 把 ContinueConversation/OpenUrl events 转发给宿主。
          console.info(event.humanFriendlyMessage);
        }}
      />
    </view>
  );
}
```

原始 response 必须是 OpenUI Lang，而不是 Markdown code fence。每一行都是一条
assignment，渲染入口必须命名为 `root`：

```text
identifier = Component(positional, arguments)
$variable = defaultValue
data = Query("tool_name", { argument: $variable }, { fallback: true })
```

## 你需要负责什么

| 部分                    | 负责人   | 作用                                                                                              |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `@lynx-js/genui/openui` | 这个包   | OpenUI parser/runtime adapter、ReactLynx renderer、内置 Library、状态/actions 和 prompt helpers。 |
| 你的 Agent 服务         | 你的应用 | 使用 OpenUI system prompt 调用模型，并返回原始 OpenUI Lang 文本。                                 |
| 你的 transport adapter  | 你的应用 | 流式追加或设置累计 response 文本，并取消已经过期的请求。                                          |
| 你的 tool provider      | 你的应用 | 实现 `Query()` 和 `Mutation()` 引用的工具。                                                       |
| 你的 host shell         | 你的应用 | 持久化状态，并处理 renderer 抛出的 assistant/open-URL actions。                                   |

## 首次接入要知道

- OpenUI v0.5 应优先使用 `<OpenUiRenderer response={...}>`。旧版
  `result={parseResult}` 路径可以渲染预解析的静态树，但不拥有 v0.5 的 query、
  mutation 或响应式状态运行时。
- 模型流式输出期间，把累计 response 和 `isStreaming` 一起传入。增量 parser
  会持续保留已完成且可渲染的 statements；内置交互在流结束前保持禁用。
- 完整 response 到达后，Query defaults 和 `initialQueryResults` 会进入第一次同步
  渲染。预取结果必须用 Query assignment name（而不是 tool name）作为 key。如果同时
  传入 `toolProvider`，Query 会在 commit 后重新校验，并在响应式参数变化时重新执行。
  `Mutation()` 只会通过 action 中的 `@Run(...)` 触发。
- `onAction` 接收 `@ToAssistant(...)`、`@OpenUrl(...)` 等宿主 actions；状态
  steps 和工具 steps 会先在 runtime 内执行。
- `onError` 会返回结构化的 parser、runtime、render 和 tool errors，适合接入
  Agent correction loop。
- `createOpenUiLibrary()` 内置 26 个组件。额外 definitions 会追加在默认组件后；
  如果名称相同，后加入的组件会替换默认实现。

## 更多文档

- [概览与架构](./docs/overview_zh.md)
- [Libraries、内置组件与自定义组件](./docs/library-guide_zh.md)
- [System Prompts](./docs/system-prompts_zh.md)
- [打开 GenUI Playground](https://lynx-stack.dev/genui/#/openui)
- [阅读 OpenUI Lang v0.5 规范](https://www.openui.com/docs/openui-lang/specification-v05)
