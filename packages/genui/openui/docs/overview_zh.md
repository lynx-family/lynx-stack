# 概览与架构

这篇文档解释 `@lynx-js/genui/openui` 是什么、OpenUI Lang 如何映射成可信的
ReactLynx 组件树，以及一段流式 Agent response 如何变成最终 UI。

## 这个包是什么

`@lynx-js/genui/openui` 是面向 OpenUI Lang v0.5 的 ReactLynx **客户端运行时**。
它把 `@openuidev/lang-core` 提供的框架无关 parser/evaluator，与 ReactLynx
renderer 和内置移动端组件 Library 组合在一起。

这个包提供：

- 处理原始或预解析 OpenUI 输入的 `<OpenUiRenderer>`；
- `createOpenUiLibrary()` 和 26 个可信的默认组件实现；
- 面向模型流式输出的增量解析；
- 响应式 `$variables`、表达式求值和表单状态；
- `Query()`、`Mutation()` 和多步骤 `Action([...])` 执行；
- 结构化 parser、runtime、render 和 tool errors；
- 用来向 Agent 描述同一组件 contract 的 prompt builders。

它**不会**托管 Agent、调用 LLM、定义网络传输，也不提供你的后端工具。这些部分由
你的应用负责。

## Quick start

在 ReactLynx 应用里安装包，并引入可选的默认主题：

```sh
pnpm add @lynx-js/genui @lynx-js/react @lynx-js/lynx-ui
```

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo } from '@lynx-js/react';

import '@lynx-js/genui/openui/styles/theme.css';

export function GeneratedView({ response }: { response: string }) {
  const library = useMemo(() => createOpenUiLibrary(), []);

  return (
    <view className='openui-light'>
      <OpenUiRenderer response={response} library={library} />
    </view>
  );
}
```

最简单的合法 response 是：

```text
root = Stack([message])
message = TextContent("Hello OpenUI")
```

OpenUI 使用位置参数。Parser 按每个组件 Zod schema 的字段顺序，把位置参数映射为
具名 props。它允许 forward references，所以 root 可以引用 response 后面才声明的
statements。

## 流式模型输出

把累计模型文本作为 `response`，把生成状态作为 `isStreaming` 传给 renderer。
如果业务已经有 React 状态或会话状态，直接复用即可，无需另外创建 parser。

- `response` 是截至当前收到的完整文本，不是最新一个 delta。收到 delta 时追加；
  transport 下发累计快照时，直接替换文本。
- 整个生成期间保持 `isStreaming={true}`。UI 会逐步展示，Query 执行、mutation
  注册和内置交互会等待生成完成。
- 成功结束时，把最终权威文本和 `isStreaming={false}` 一起更新。该标记默认是
  `false`，展示静态或已完成的历史 response 时可以省略。

### 接入 transport

把文本和生成状态放在同一个 state 对象中，确保一起更新。下面展示 transport 的
回调接法；根据服务返回的是 delta 还是累计快照，选择对应的文本回调：

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo, useState } from '@lynx-js/react';

export function GeneratedView() {
  const library = useMemo(() => createOpenUiLibrary(), []);
  const [output, setOutput] = useState({
    response: null as string | null,
    isStreaming: false,
  });

  function onStart() {
    setOutput({ response: '', isStreaming: true });
  }

  function onDelta(delta: string) {
    setOutput((current) => ({
      response: (current.response ?? '') + delta,
      isStreaming: true,
    }));
  }

  function onSnapshot(fullText: string) {
    setOutput({ response: fullText, isStreaming: true });
  }

  function onDone(finalText: string) {
    setOutput({ response: finalText, isStreaming: false });
  }

  function onFailureOrCancel() {
    setOutput({ response: null, isStreaming: false });
  }

  // 把这些回调接到已有 transport。
  return <OpenUiRenderer library={library} {...output} />;
}
```

如果完成事件没有最终文本，保留累计 response，只更新标记：
`setOutput(current => ({ ...current, isStreaming: false }))`。
即使最终文本和最后一次增量相同，也必须切换标记，才能启用 Query、完成后的错误报告
和交互。自定义交互组件也应遵循 `useIsStreaming()`。

### 增量解析是怎么工作的

只要 `library` 对象不变，renderer 就会复用同一个 streaming parser。
虽然每次传入累计全文，parser 会识别追加的文本、缓存已完成的语句，并重新解析
尚未完成的尾部以预览部分输出。Forward references 在目标声明到达后变为可渲染状态。
改写或缩短之前收到的文本会重置解析缓存；用 `useMemo` 或模块常量保持 Library 稳定。

这是语句级增量解析：每次文本更新仍会做预处理和结果重建，一条很长但尚未完成的语句
也可能被反复解析。它没有提供组件级 patch 协议。文本不变、只切换 `isStreaming`
时，不会重新解析。

### 完成、取消与新会话

使用 SSE 时，只有成功的 `done` 事件才代表完成，并应以其中的最终文本为准。
连接关闭本身不代表成功。

异常或取消时，用 `{ response: null, isStreaming: false }` 清空未完成文本，
避免为半成品启用 Query 或交互。更新状态不会取消网络请求；transport 负责取消和错误
报告。开始下一次生成前，停止旧请求、拒绝其迟到事件，再重置文本。
清空 response 不会重置运行时表单状态；新会话需要重置这些状态时，为 renderer
使用新的 `key`。

## 心智模型

在普通 React 中，是你的源码选择组件并传入 props：

```tsx
<Card>
  <TextContent text='Hello' />
</Card>;
```

在 OpenUI 中，Agent 用声明式 assignments 表达同样的意图：

```text
root = Card([message])
message = TextContent("Hello")
```

Renderer 不会执行生成的 JavaScript。它用 `Library` 生成的 JSON Schema 解析文本，
把合法 component calls 转换为 element tree，再按名称查找对应的可信 ReactLynx
实现。没有注册进 Library 的组件无法被渲染。

所以 Library 是 wire 两侧共享的 contract：

```text
Agent prompt                              ReactLynx client
Library signatures                       Library implementations
Stack(children, direction?, ...)   <──►   Stack -> trusted renderer
Text(text, variant?)               <──►   Text  -> trusted renderer
```

新增或覆盖组件时，必须保持 prompt Library 和 renderer Library 一致。名称或 prop
顺序不一致，会让 Agent 产出 client 无法校验的文本。

## 一分钟理解 OpenUI Lang v0.5

一段 OpenUI program 每行包含一个 assignment，共有三类 statement：

| Statement | 示例                                                               | 用途                             |
| --------- | ------------------------------------------------------------------ | -------------------------------- |
| Component | `header = CardHeader("Orders")`                                    | 声明可渲染组件。                 |
| State     | `$status = "open"`                                                 | 声明响应式客户端状态及其默认值。 |
| Data      | `orders = Query("list_orders", { status: $status }, { rows: [] })` | 声明读或写工具操作。             |

表达式可以包含 primitives、arrays、objects、references、member access、operators、
ternaries，以及 `@Count(...)` 等 built-ins。Renderer 必须找到名为 `root` 的
statement；默认情况下它的组件应为 `Stack`，因为 `Stack` 是默认 Library root。

State values 是响应式的。当 `$status` 改变，读取它的表达式会重新求值，参数依赖
它的 Queries 也会刷新。

```text
$status = "open"
orders = Query("list_orders", { status: $status }, { rows: [] })
root = Stack([summary, refresh])
summary = TextContent("Orders: " + @Count(orders.rows))
refresh = Button("Refresh", Action([@Run(orders)]), "secondary")
```

完整语言语法和 built-ins 见
[OpenUI Lang v0.5 规范](https://www.openui.com/docs/openui-lang/specification-v05)。

## 端到端全貌

OpenUI 是一个由 Agent 编写声明式 UI、client 解析求值并渲染的循环。

```text
       ┌──────────────── Your application ────────────────┐
user   │                                                  │
input ─┼─► Transport ──prompt/action──► Agent service     │
       │      ▲                              │             │
       │      │   accumulated OpenUI text    │             │
       │      └──────────────────────────────┘             │
       │      │                                            │
       │      ▼                                            │
       │ <OpenUiRenderer response={text} ...>               │
       │      │                                            │
       │      ├─ parser ─► AST ─► evaluator ─► UI tree     │
       │      ├─ Store ($state + form state)               │
       │      └─ QueryManager ─► your toolProvider         │
       │                    │                               │
       │                    └─ onAction ─► host/transport ──┤
       └───────────────────────────────────────────────────┘
```

1. 你的 transport 把用户请求发送给 Agent 服务。
2. 服务使用由同一 client component contract 构建的 OpenUI system prompt 调用模型。
3. Transport 累积文本 delta，并把 `response` 和 `isStreaming` 传给
   `<OpenUiRenderer>`。
4. Streaming parser 校验已完成的 statements，并解析引用关系。
5. Runtime 初始化状态并求值表达式。生成完成后，通过你的 `toolProvider` 执行 Queries。
6. Renderer 遍历求值后的 root，挂载 Library 中可信的 ReactLynx 组件。
7. 用户交互触发 action steps。宿主 actions 通过 `onAction` 抛出；状态和 tool
   steps 留在 runtime 内执行。

## Client 内部

`response` 创建完整的 v0.5 runtime；`isStreaming` 控制何时启用 Query 和交互：

```text
response text
     │
     ▼
createStreamingParser(library.toJSONSchema(), library.root)
     │
     ├─ ParseResult: root + state/query/mutation statements + metadata
     │
     ▼
useOpenUIState
     ├─ Store: $variables and form fields
     ├─ QueryManager: Query/Mutation execution and cache
     ├─ EvaluationContext: state and data reference resolution
     └─ structured errors
     │
     ▼
RenderNode ──name lookup──► library.components[name].component
```

几个重要的 runtime 行为：

- **增量解析。** 累计 response 持续增长时，parser 会缓存已经完成的 statements。
  Forward references 在目标到达后变为可渲染状态。
- **稳定的 Library。** 用 `useMemo` 或组件外常量只创建一次 Library。改变其对象
  identity 会创建新 parser，并可能丢失已有解析工作。
- **Streaming guard。** 生成期间传入 `isStreaming={true}`。Query 执行和 mutation
  注册会等待输出稳定，内置交互也保持禁用。
- **响应式状态。** `$variables` 和 form values 位于同一个外部 Store 中。
  `onStateUpdate` 可以持久化 snapshots；`initialState` 中以 `$` 开头的值会 hydrate
  响应式 declarations。
- **Queries 与 mutations。** Response 完成流式生成后，Query 的 defaults 和预取的
  `initialQueryResults` 会进入第一次同步渲染。如果配置了 tool provider，Query 会在
  commit 后重新校验，并在引用状态变化时重新执行。Mutation 只注册定义，直到 action
  调用 `@Run(mutationRef)` 才执行。
- **顺序 actions。** `@Run`、`@Set`、`@Reset`、`@ToAssistant` 和 `@OpenUrl`
  按顺序执行。Mutation 失败会终止后续 steps。
- **组件软失败。** Element 的 component name 未注册时不会渲染任何内容。其他
  parse、evaluation、render 和 tool failures 会在 streaming 稳定后交给
  `onError`。

## 谁负责什么

| 部分               | 运行位置                | 负责人               | 职责                                                                            |
| ------------------ | ----------------------- | -------------------- | ------------------------------------------------------------------------------- |
| Agent 服务         | Server                  | 你的应用             | 使用 system prompt 和 component/tool contract 生成原始 OpenUI Lang。            |
| Transport adapter  | Client shell            | 你的应用             | 传入 delta 或快照、确认完成、处理取消，并转发 conversation actions。            |
| `Library`          | Client + Agent contract | 双方共享             | 命名组件、固定位置参数顺序、提供 JSON Schema，并把名称映射为可信 renderer。     |
| Parser/evaluator   | Client                  | 这个包 + `lang-core` | 解析 statements、校验 props、解析 state/data expressions，并报告结构化 errors。 |
| Store/QueryManager | Client                  | 这个包 + `lang-core` | 管理响应式/form state，并执行工具支持的 Query/Mutation statements。             |
| `<OpenUiRenderer>` | Client                  | 这个包               | 渲染求值后的 root，把状态、tools 和 actions 接到 ReactLynx 组件。               |
| `toolProvider`     | Client integration      | 你的应用             | 把工具名映射到 async functions 或 MCP-compatible client。                       |

## `<OpenUiRenderer>` props

传入累计全文 `response`，生成期间显式设置 `isStreaming={true}`。
`isStreaming` 默认为 `false`，用于已完成的 response。

| Prop                  | 类型                                       | 必填 | 用途                                               |
| --------------------- | ------------------------------------------ | ---- | -------------------------------------------------- |
| `response`            | `string \| null`                           | 是   | 累计的原始 OpenUI Lang 文本，启用 v0.5 runtime。   |
| `library`             | `Library`                                  | 是   | 组件 schemas 和可信 ReactLynx 实现。               |
| `isStreaming`         | `boolean`                                  | 否   | 标记模型输出仍不完整，并禁用不稳定交互/tool work。 |
| `onAction`            | `(event: ActionEvent) => void`             | 否   | 接收需要宿主处理的 assistant 和 URL actions。      |
| `onStateUpdate`       | `(state: Record<string, unknown>) => void` | 否   | 接收响应式/form state snapshots，以便持久化。      |
| `initialState`        | `Record<string, unknown>`                  | 否   | Hydrate `$variables` 和 form state。               |
| `initialQueryResults` | `Record<string, unknown>`                  | 否   | 为第一次同步渲染提供预取的 Query 结果。            |
| `onParseResult`       | `(result: ParseResult \| null) => void`    | 否   | 暴露最新原始 AST 和 parser metadata。              |
| `toolProvider`        | function map、MCP-like client 或 `null`    | 否   | 执行 Query/Mutation statements 引用的工具。        |
| `queryLoader`         | `ReactNode`                                | 否   | Queries 执行期间替换默认 indicator。               |
| `onError`             | `(errors: OpenUIError[]) => void`          | 否   | Streaming 结束后接收去重的结构化 errors。          |

`<OpenUiRenderer result={parseResult} library={library}>` 仍为 legacy/static
callers 保留。它可以渲染预解析 element tree 并转发简单 actions，但不会创建 v0.5
QueryManager，也无法完整执行 `@Run`、`@Set` 和 `@Reset`。新 v0.5 接入不要使用
这条路径。

### 预取 Query 结果

如果 Query 数据在 ReactLynx 首屏前已经可用，可以传入 `initialQueryResults`。每个
key 都是 Query assignment name（statement ID），因此调用同一个 tool、但参数不同的
Queries 也不会混淆：

```text
orders = Query("list_orders", { status: "open" }, { rows: [] })
```

```tsx
<OpenUiRenderer
  response={response}
  library={library}
  initialQueryResults={{ orders: prefetchedOrders }}
/>;
```

预取值（包括 `null`、`false` 或 `0`）会在第一次同步渲染时优先于 Query default。
如果传入 `toolProvider`，runtime 会在 commit 后开始正常的 Query 执行，并在请求完成后
替换 fallback。如果预取结果是无需重新校验的不可变 snapshot，可以不传 provider。

## Tool providers

本地函数可以通过 name-to-function map 传入：

```tsx
<OpenUiRenderer
  response={response}
  library={library}
  toolProvider={{
    list_orders: async ({ status }) => {
      return await api.listOrders({ status: String(status) });
    },
    save_order: async (args) => await api.saveOrder(args),
  }}
/>;
```

也可以传入带 `callTool({ name, arguments })` 的 MCP-compatible 对象。Runtime 会在
表达式求值前提取结构化 MCP tool result。缺失工具和工具失败会通过 `onError`
报告。

## Exports

| 导入                                        | 你得到什么                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@lynx-js/genui/openui`                     | Renderer、parser/runtime、hooks、公共 types，以及由默认 catalog 支持的 Library factory。 |
| `@lynx-js/genui/openui/explicit`            | Runtime surface，以及用于显式选择 definitions 的无 catalog Library factory。             |
| `@lynx-js/genui/openui/catalog`             | 所有内置 component definitions 的聚合再导出。                                            |
| `@lynx-js/genui/openui/catalog/<Component>` | 单个内置 definition 及其组件级依赖，例如 `catalog/Stack`。                               |
| `@lynx-js/genui/openui/prompt`              | Headless prompt Library、prompt builder、默认 prompt 和 prompt-specific types。          |
| `@lynx-js/genui/openui/styles/theme.css`    | 可选的 light/dark CSS custom-property tokens。                                           |

组件样式、core renderer stylesheet 和 Material Icons font 都是由对应模块自动引入的
实现细节。不要导入 `styles/catalog` 或 `dist/core` 下的私有文件。

## 下一步

- [Libraries、内置组件与自定义组件](./library-guide_zh.md)
- [System Prompts](./system-prompts_zh.md)
- [打开 OpenUI Playground](https://lynx-stack.dev/genui/#/openui)
