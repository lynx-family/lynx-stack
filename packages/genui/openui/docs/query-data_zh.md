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
`@Set`、`@Reset` 仍只操作输入和选择状态。Lynx OpenUI 在共享 lang-core 内置函数注册表中注册 `@Append(array, item)`，供解析、求值和 prompt 生成共同使用。它返回包含原数组元素和末尾一项的新数组；作为 item 传入的数组保持嵌套。该函数要求恰好两个参数，且第一个参数必须是数组，否则抛错。它不会修改原数组，也不会在 Mutation 运行前写入数据。
完整值基于触发动作时的渲染快照计算；多个窗口同时写同一 Query 时，后一次写入会覆盖前一次结果。
`data-tools` 入口不依赖 Renderer、组件库、浏览器或原生 API；存储、传输和工具注册由宿主提供。

## 数据操作示例

以下每个示例都是完整的 OpenUI response，使用内置组件库和同一组宿主数据工具。
不同 response 使用独立的 artifact scope。Query 的赋值名称同时作为资源 `key` 和
`initialQueryResults` 的键，例如 `tasks` 对应 `{ tasks: { items: [...] } }`。

| 操作                 | 表达式或值                                   | 是否持久化    |
| -------------------- | -------------------------------------------- | ------------- |
| 读取或刷新           | `Query(...)`，通过 `@Run(tasks)` 刷新        | 否            |
| 递增或递减           | `counter + 1`、`counter - 1`                 | 通过 Mutation |
| 更新对象             | 包含所有需保留字段的完整对象                 | 通过 Mutation |
| 编辑条目或切换状态   | `@Each(...)` 配合 ID 比较                    | 通过 Mutation |
| 追加一项             | `@Append(array, item)`                       | 通过 Mutation |
| 删除单条或多条       | `@Filter(...)`                               | 通过 Mutation |
| 批量更新             | 对全部条目执行 `@Each(...)`                  | 通过 Mutation |
| 清空列表             | `{ items: [] }`                              | 通过 Mutation |
| 筛选、排序或统计视图 | `@Filter`、`@Sort`、`@Count`、`@Sum`、`@Avg` | 否            |

### 数值：递增、递减和重置

Query 结果可以直接是标量，不要求对象包装。重置已保存的数据需要 Mutation；
`@Reset($draft)` 只恢复已声明 UI 状态变量的默认值，不会重置 Query 数据或删除存储。

```text
root = Column([Text("Count: " + counter), Buttons([Button("Increase", Action([@Run(increase), @Run(counter)])), Button("Decrease", Action([@Run(decrease), @Run(counter)])), Button("Reset", Action([@Run(resetCounter), @Run(counter)]))])])
counter = Query("openui_query", { key: "counter" }, 0)
increase = Mutation("openui_mutation", { key: "counter", value: counter + 1 })
decrease = Mutation("openui_mutation", { key: "counter", value: counter - 1 })
resetCounter = Mutation("openui_mutation", { key: "counter", value: 0 })
```

### 对象：修改字段、切换布尔值和恢复默认值

每个 Mutation 都提供完整的新对象。修改主题时，继续传入原有的 `notifications` 和
`language`；省略的字段会被删除。这里的恢复默认值会把默认对象显式写入存储。

```text
root = Column([Text("Theme: " + preferences.theme), Text(preferences.notifications ? "Notifications on" : "Notifications off"), Buttons([Button("Dark theme", Action([@Run(useDarkTheme), @Run(preferences)])), Button("Toggle notifications", Action([@Run(toggleNotifications), @Run(preferences)])), Button("Reset preferences", Action([@Run(resetPreferences), @Run(preferences)]))])])
preferences = Query("openui_query", { key: "preferences" }, { theme: "light", notifications: true, language: "en" })
useDarkTheme = Mutation("openui_mutation", { key: "preferences", value: { theme: "dark", notifications: preferences.notifications, language: preferences.language } })
toggleNotifications = Mutation("openui_mutation", { key: "preferences", value: { theme: preferences.theme, notifications: !preferences.notifications, language: preferences.language } })
resetPreferences = Mutation("openui_mutation", { key: "preferences", value: { theme: "light", notifications: true, language: "en" } })
```

### 列表：添加、编辑、切换状态、删除和批量修改

添加使用 `@Append(tasks.items, newItem)`，列表不再有固定容量。
Append 每次只添加一项：`@Append([1], [2, 3])` 返回 `[1, [2, 3]]`，不会展开为
`[1, 2, 3]`。数字 ID 取当前最大值加一，空列表从一开始；删除最大 ID 后，该 ID 以后可能被复用。
如果身份需要跨删除、scope 或并发写入保持唯一，应由宿主提供相应 ID 策略。

点击 **New task**，输入标题后点击 **Add**。空标题对应显式空 Action，既不保存，
也不发起对话请求。Mutation 和 Query 刷新成功后关闭表单，重新打开时挂载新的输入框。
先点击某行的 **Edit**，再在编辑区保存、切换完成状态或删除该项。

```text
root = Column([Text(@Count(tasks.items) + " tasks"), creator, taskList, editor, Buttons([Button("Complete all", Action([@Run(completeAll), @Run(tasks)])), Button("Delete completed", Action([@Run(deleteCompleted), @Run(tasks), @Reset($selectedId, $editTitle)])), Button("Clear all", Action([@Run(clearTasks), @Run(tasks), @Reset($selectedId, $editTitle)]))])])
$adding = false
$newTitle = ""
$selectedId = ""
$editTitle = ""
tasks = Query("openui_query", { key: "tasks" }, { items: [{ id: 1, title: "Plan the release", done: false }, { id: 2, title: "Review changes", done: true }] })
addTask = Mutation("openui_mutation", { key: "tasks", value: { items: $newTitle != "" ? @Append(tasks.items, { id: @Max(tasks.items.id) + 1, title: $newTitle, done: false }) : tasks.items } })
saveTask = Mutation("openui_mutation", { key: "tasks", value: { items: @Each(tasks.items, "task", task.id == $selectedId ? { id: task.id, title: $editTitle, done: task.done } : task) } })
toggleTask = Mutation("openui_mutation", { key: "tasks", value: { items: @Each(tasks.items, "task", task.id == $selectedId ? { id: task.id, title: task.title, done: !task.done } : task) } })
deleteTask = Mutation("openui_mutation", { key: "tasks", value: { items: @Filter(tasks.items, "id", "!=", $selectedId) } })
completeAll = Mutation("openui_mutation", { key: "tasks", value: { items: @Each(tasks.items, "task", { id: task.id, title: task.title, done: true }) } })
deleteCompleted = Mutation("openui_mutation", { key: "tasks", value: { items: @Filter(tasks.items, "done", "==", false) } })
clearTasks = Mutation("openui_mutation", { key: "tasks", value: { items: [] } })
creator = $adding ? Card([TextField("New title", $newTitle, "shortText", null, null, "$newTitle"), Buttons([Button("Add", $newTitle != "" ? Action([@Run(addTask), @Run(tasks), @Reset($adding, $newTitle)]) : Action([])), Button("Cancel", Action([@Reset($adding, $newTitle)]))])]) : Button("New task", Action([@Set($adding, true), @Reset($newTitle, $selectedId, $editTitle)]))
taskList = List(@Each(tasks.items, "task", Row([Text(task.title), Tag(task.done ? "Completed" : "Open"), Button("Edit", Action([@Set($selectedId, task.id), @Set($editTitle, task.title), @Reset($adding, $newTitle)]))])), null, "vertical", "stretch", "s", false)
editor = $selectedId != "" ? Card([TextField("Edit title", $editTitle, "shortText", null, null, "$editTitle"), Buttons([Button("Save", Action([@Run(saveTask), @Run(tasks), @Reset($selectedId, $editTitle)])), Button("Toggle completed", Action([@Run(toggleTask), @Run(tasks), @Reset($selectedId, $editTitle)])), Button("Delete", Action([@Run(deleteTask), @Run(tasks), @Reset($selectedId, $editTitle)])), Button("Cancel", Action([@Reset($selectedId, $editTitle)]))])]) : null
```

行模板和选择 Action 保持在 `@Each` 内联表达式中，才能访问循环变量 `task`。
TextField 的名称与 `$state` 键完全一致。选择与保存使用两个独立动作：
Mutation 参数读取产生该动作时的状态快照，因此在同一个 Action 中先
`@Set($selectedId, task.id)` 再运行 Mutation，读取到的仍是此前的选择。

清空操作会保存空列表，不会删除 Query 资源，也不会恢复种子条目。种子数据保留在
Query 默认值中。要移除已保存值并回到原始默认值，应通过宿主存储适配器删除该 scope
的已保存快照，再刷新或重开 artifact。

### 视图：搜索、筛选、排序和统计，不写入数据

派生视图保留原始 Query 数据。搜索使用区分大小写的子串匹配；`@Sort` 返回排序后的
视图，排序方向通过 `@Set` 显式修改。条目数和总分直接根据 Query 数组计算，不另外
保存冗余计数。

```text
root = Column([TextField("Search title", $search, "shortText", null, null, "$search"), Buttons([Button($onlyOpen ? "Show all" : "Show open", Action([@Set($onlyOpen, !$onlyOpen)])), Button("Reverse sort", Action([@Set($direction, $direction == "asc" ? "desc" : "asc")]))]), Text(@Count(visible) + " visible / " + @Count(tasks.items) + " total"), Text(@Count(@Filter(tasks.items, "done", "==", false)) + " open"), Text("Points: " + @Sum(tasks.items.points) + "; average: " + @Round(@Avg(tasks.items.points), 1)), List(@Each(visible, "task", Text(task.title + " (" + task.points + " points)")), null, "vertical", "stretch", "s", false)])
$search = ""
$onlyOpen = false
$direction = "asc"
tasks = Query("openui_query", { key: "tasks" }, { items: [{ id: 1, title: "Plan release", done: false, points: 3 }, { id: 2, title: "Review changes", done: true, points: 2 }, { id: 3, title: "Write tests", done: false, points: 5 }] })
visible = @Sort(@Filter($onlyOpen ? @Filter(tasks.items, "done", "==", false) : tasks.items, "title", "contains", $search), "title", $direction)
```

`tasks.items.points` 把数值字段投影为数组。其他可用操作还包括 `@Min`、`@Max`、
`@First` 和 `@Last`。只有需要保存变换结果时才运行 Mutation，之后刷新源 Query。

### 加载、失败和并发修改

用 `change.status == "loading"` 展示保存中状态，用 `change.status == "error"`
展示失败，其中 `change` 替换为 Mutation 的语句名称。保存时隐藏冲突的操作控件，
可参考 Todo List demo。将 Query 刷新和草稿重置放在 `@Run(change)` 后面，
这样写入被拒绝时不会宣称成功或清除用户输入。初始化与读取不会保存默认值；
无效 JSON 或存储错误应拒绝调用，不能悄悄改为请求模型。

动作参数基于触发动作的渲染快照计算。同一个 Action 内的多个 Mutation 不构成事务，
也不会自动串接其计算结果。相关修改应合并为一次完整替换；需要跨客户端
原子追加、原子递增或冲突检测时，另行接入具备服务端并发控制的宿主工具。
纯表达式 `@Append` 不负责 ID 生成或并发控制。

Prompt 配置见 [System Prompts](./system-prompts_zh.md)；Renderer 生命周期和
`toolProvider` 见[概览与架构](./overview_zh.md)。
