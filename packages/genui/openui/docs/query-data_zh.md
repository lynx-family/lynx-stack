# 通用数据处理工具

数据处理工具是按需启用的能力，用于生成界面中的数据读取、变换和更新。
本指南说明 Agent、OpenUI Renderer 与宿主的数据处理和存储实现之间如何协作。

## 各自负责什么

Agent 负责生成 OpenUI DSL。它根据 prompt 中声明的工具编写 `Query` 默认值和
`Mutation` 操作，由 Renderer 调用宿主提供的工具执行。

Renderer 负责解析 DSL、用 Query 默认值完成首屏渲染，并通过 `toolProvider`
执行 `Query` 和 `Mutation`。宿主复用 Renderer 已有的解析结果初始化工具，再对
宿主自己的存储执行读取和确定性修改。

```text
宿主选择启用两个工具
        │
        ├── prompt ──► Agent 生成 Query/Mutation DSL
        │                         │
        │                         ▼
        └── toolProvider ◄── OpenUiRenderer 解析并渲染
                  ▲              │
                  │              ├── onParseResult ──► 初始化默认值
                  │              ├── Query ──────────► 读取数据
                  │              └── Action/Mutation ► 更新数据 ─► 刷新 Query
                  └───────────────────────────────────────────────────┘
```

## 1. 宿主按需启用

只有客户端会提供这两个工具时，才把它们声明给 Agent。`promptOptions.tools`
同时包含两个名称且启用 tool calls 时，共享 prompt 才会加入数据处理规则。
Prompt 只告诉 Agent 应生成怎样的 DSL，不会实现或执行工具。

```ts
const prompt = buildOpenUiSystemPrompt({
  promptOptions: {
    tools: ['openui_query', 'openui_mutation'],
  },
});
```

为当前 artifact 创建 Renderer 侧的工具协调器，并与宿主已有工具合并：

```ts
const dataTools = createQueryDataTools({
  call: request => dataHost.execute(request),
});
dataTools.setScope(artifactId);

const toolProvider = {
  ...existingToolProvider,
  ...dataTools.tools,
};
```

同一个 artifact 重开时应使用相同 scope，不同 artifact 使用不同 scope。
宿主适配器把 `{ scope, operation, args }` 请求交给对应存储，并返回操作结果；
失败时 reject。`initialize` 为 scope 注册默认值，但不写入存储；`query` 读取
Query 数据；`mutation` 用请求中的 `value` 完整替换指定 Query 的结果。

## 2. Agent 在 DSL 中声明数据

可变业务数据放在 Query 结果中。默认值提供首屏数据结构，也作为没有已保存数据
时的回退值。Mutation 指定 Query 资源，并携带由 OpenUI 表达式计算出的完整新值。
`key` 和 `value` 是宿主工具的参数约定，不是 Mutation 的特殊语法；运行时会先对参数对象求值，再调用工具。

```text
root = Stack([TextContent("Count: " + counter.count), Button("Add", Action([@Run(increment), @Run(counter)]), "primary")])
counter = Query("openui_query", { key: "counter" }, { count: 0 })
increment = Mutation("openui_mutation", { key: "counter", value: { count: counter.count + 1 } })
```

按钮在同一个 Action 中先运行 Mutation，再刷新 Query。刷新会读取最新的数据快照，
并更新界面上的数据字段。这种纯数据交互只发生在 Renderer 和宿主之间，不会再请求
Agent。需要改变界面结构或继续对话时再使用 `@ToAssistant`。

## 3. Renderer 把解析出的默认值交给宿主

将同一个 `toolProvider` 传给 `<OpenUiRenderer>`。Query 默认值可用于首屏同步渲染，
首屏不需要等待数据工具初始化。在 `onParseResult` 中复用 Renderer 已产生的解析结果：

```tsx
<OpenUiRenderer
  response={response}
  isStreaming={isStreaming}
  toolProvider={toolProvider}
  onParseResult={result => {
    if (!result) return;
    dataTools.publishDefaults(
      artifactId,
      getQueryDefaults(result, { source: response }),
    );
  }}
/>;
```

Renderer 可能在同一生命周期中启动 Query，因此 `createQueryDataTools` 会让
Query/Mutation 等待宿主完成最近一次初始化，默认超时为五秒。流式 response 增长时，
继续发布已完成的默认值；协调器会合并多个内联代码块的默认值，并跳过未变化的初始化。
Renderer 卸载时调用 `dispose()`。scope 改变后，等待中的调用会被拒绝，迟到的响应会被忽略。

恢复已有 artifact 时，从宿主读取已保存的数据并通过 `initialQueryResults` 传入。
已保存值会覆盖同名 Query 的宿主预取值，其他名称的预取值仍保留。没有传入结果时，
Renderer 使用 DSL 默认值。恢复值只是快照，不会变成新默认值；清空宿主保存的数据后会回到
原始 DSL 行为。工具初始化和读取都不会把默认值写入存储。

## 选择接入方式

异步存储或原生桥接使用 `createQueryDataTools`。它协调 `initialize`、`query` 和
`mutation` 请求，并提供可直接传给 `toolProvider` 的函数。

宿主已有同步存储且希望自行注册工具时，使用 `createQueryDataStore`。提供
`initialQueryResults`、scope、同步 `read` 和原子 `write`。`getQueryDefaults` 从已有
解析结果提取默认值；解析流式文本时传入 `source`，这样可以排除 parser 自动补全的末尾
Query。调用 `store.mutate(key, value)` 保存完整的新值。

```ts
import {
  createQueryDataStore,
  getQueryDefaults,
} from '@lynx-js/genui/openui/data-tools';

const defaults = getQueryDefaults(parseResult, { source });
const store = createQueryDataStore({
  scope: artifactId,
  initialQueryResults: defaults,
  storage: {
    read: scope => storage.read(scope),
    write: (scope, snapshot) => storage.writeAtomically(scope, snapshot),
  },
});
```

Mutation 复制并校验 JSON 值，完整替换指定 Query 的结果后一次性写入；不会合并对象字段。
`false`、`0`、`null` 和空数组都是有效值。无效值或存储失败会抛错。
计算复用 OpenUI 表达式：算术用于计数，`@Each` 用于编辑列表，`@Filter` 用于删除条目。
`@Set`、`@Reset` 仍只操作输入和选择状态。当前语言没有数组追加内置函数，新增条目需要宿主提供相应工具。
完整值基于触发动作时的渲染快照计算；多个窗口同时写同一 Query 时，后一次写入会覆盖前一次结果。
`data-tools` 入口不依赖 Renderer、组件库、浏览器或原生 API；存储、传输和工具注册由宿主提供。

Prompt 配置见 [System Prompts](./system-prompts_zh.md)；Renderer 生命周期和
`toolProvider` 见[概览与架构](./overview_zh.md)。
