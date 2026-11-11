# Data processing tools

Data processing tools are an opt-in capability for reading, transforming, and
updating data in generated surfaces. This guide covers the handoff between the
Agent, the OpenUI renderer, and the host that supplies data execution and storage.

## Who does what

The Agent writes OpenUI DSL. It declares `Query` defaults and `Mutation`
operations according to the tools advertised in its prompt. The renderer calls
the host-provided tools to execute those operations.

The renderer parses the DSL, shows Query defaults for the first render, and
executes `Query` and `Mutation` statements through its `toolProvider`. The host
initializes the tools from the renderer's existing parse result, then
performs reads and deterministic mutations against host-owned storage.

```text
Host opts in to both tools
        │
        ├── prompt ──► Agent generates Query/Mutation DSL
        │                         │
        │                         ▼
        └── toolProvider ◄── OpenUiRenderer parses and renders
                  ▲              │
                  │              ├── onParseResult ──► initialize defaults
                  │              ├── Query ──────────► data read
                  │              └── Action/Mutation ► data update ─► Query refresh
                  └───────────────────────────────────────────────────┘
```

## 1. Opt in at the host

Advertise these data tools when the client will supply both implementations. The shared
prompt adds its data rules when both names appear in `promptOptions.tools` and
tool calls are enabled. Prompt declarations teach the Agent which DSL to
produce; they do not implement or execute the tools.

```ts
const prompt = buildOpenUiSystemPrompt({
  promptOptions: {
    tools: ['openui_query', 'openui_mutation'],
  },
});
```

Create the renderer-side tool coordinator for the artifact's stable scope and
combine its tools with any other tools the host provides:

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

Use a scope that stays the same when reopening the same artifact and differs
for unrelated artifacts. The host adapter maps each request's `{ scope,
operation, args }` to its storage and returns the operation result or rejects
on failure. `initialize` registers defaults for that scope; it must not persist
them. `query` reads a Query value, and `mutation` replaces it with the supplied
complete `value`.

## 2. The Agent declares data in DSL

The Agent keeps mutable business data in Query results. Defaults provide a
shape-correct first render and a fallback for a host without saved data. A
Mutation names the Query resource and supplies its complete next value, computed
with existing OpenUI expressions.
`key` and `value` are this host tool's arguments, not special Mutation syntax.
The runtime evaluates the argument object before calling the tool.

```text
root = Stack([TextContent("Count: " + counter.count), Button("Add", Action([@Run(increment), @Run(counter)]), "primary")])
counter = Query("openui_query", { key: "counter" }, { count: 0 })
increment = Mutation("openui_mutation", { key: "counter", value: { count: counter.count + 1 } })
```

The button runs the mutation and then refreshes the Query in the same Action.
The refresh reads the latest data snapshot and updates the rendered fields. This
data-only interaction stays in the renderer and host; it does not send another
request to the Agent. Use `@ToAssistant` when the user wants to change the
surface or continue a conversation.

## 3. The renderer hands parsed defaults to the host

Pass the same `toolProvider` to `<OpenUiRenderer>`. Query defaults participate
in the first synchronous render, so the initial UI does not wait for the data
tools to initialize. In `onParseResult`, reuse the parse result already
produced by the renderer:

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

The renderer may start Query execution in the same render lifecycle as this
callback. `createQueryDataTools` makes Query and Mutation calls wait for the
host's latest initialization, with a five-second default timeout. When an
artifact's source grows during streaming, publish completed defaults again;
the coordinator merges defaults from completed inline blocks and skips
unchanged registrations. Dispose the coordinator when the renderer unmounts.
Changing scope rejects pending calls and ignores late replies.

When restoring an artifact, read saved values from the host and pass them as
`initialQueryResults`. Saved values override explicit host prefetches for the
same Query name; prefetches for other names remain. The renderer falls back to
DSL defaults for names with no supplied result. Restored values are snapshots,
not new defaults: deleting host storage restores the original DSL behavior.
Neither initialization nor reading writes defaults to storage.

## Choose the integration level

Use `createQueryDataTools` when storage or a native bridge is asynchronous. It
coordinates the `initialize`, `query`, and `mutation` requests and exposes
functions for `toolProvider`.

Use `createQueryDataStore` when the host already has synchronous storage and
wants to implement tool registration itself. Supply `initialQueryResults`, a
scope, and synchronous `read` and atomic `write` functions. `getQueryDefaults`
extracts defaults from an existing parse result; pass `source` for streaming
results so an auto-closed trailing Query is excluded. Call `store.mutate(key, value)`
to persist a complete replacement value.

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

Mutations clone and validate the JSON value, replace the selected Query result
without merging fields, and write once. Falsy values and empty arrays are valid.
Invalid values or storage errors throw without reporting success. Compute values
with existing arithmetic, `@Each` for edited rows, and `@Filter` for deletion.
`@Set` and `@Reset` still operate only on input and selection state. The current
Lynx OpenUI runtime registers `@Append(array, item)` in the shared lang-core
builtin registry, so parsing, evaluation, and prompt generation use the same
definition. It returns a new array containing the original elements followed by
one item; an array item stays nested. It requires exactly two arguments and
rejects a non-array first argument. It does not modify the input or persist data
until the Mutation runs.
Values are computed from the render snapshot that triggered the action; concurrent
writes to the same Query from different windows use last-write-wins semantics.
The data tools entry has no renderer, catalog, browser, or native dependencies;
each host supplies storage, transport, and tool registration.

## Data operation examples

Each example below is a complete OpenUI response using the built-in catalog and
the same two host data tools. Give each response its own artifact scope.
Use the Query assignment name as its resource `key` and as the key in
`initialQueryResults`, for example `tasks` in `{ tasks: { items: [...] } }`.

| Operation                         | Expression or value                          | Persisted?       |
| --------------------------------- | -------------------------------------------- | ---------------- |
| Read or refresh                   | `Query(...)`, then `@Run(tasks)` to refresh  | No               |
| Increment or decrement            | `counter + 1`, `counter - 1`                 | Through Mutation |
| Update an object                  | Complete object, including fields to keep    | Through Mutation |
| Edit or toggle rows               | `@Each(...)` with an ID comparison           | Through Mutation |
| Append one item                   | `@Append(array, item)`                       | Through Mutation |
| Delete one or several rows        | `@Filter(...)`                               | Through Mutation |
| Bulk update                       | `@Each(...)` over all rows                   | Through Mutation |
| Clear a collection                | `{ items: [] }`                              | Through Mutation |
| Filter, sort, or aggregate a view | `@Filter`, `@Sort`, `@Count`, `@Sum`, `@Avg` | No               |

### Numbers: increment, decrement, and reset

A Query result can be a scalar; it does not need an object wrapper. Resetting
persisted data requires a Mutation. `@Reset($draft)` only restores a declared UI
state variable, and does not reset Query data or remove saved storage.

```text
root = Column([Text("Count: " + counter), Buttons([Button("Increase", Action([@Run(increase), @Run(counter)])), Button("Decrease", Action([@Run(decrease), @Run(counter)])), Button("Reset", Action([@Run(resetCounter), @Run(counter)]))])])
counter = Query("openui_query", { key: "counter" }, 0)
increase = Mutation("openui_mutation", { key: "counter", value: counter + 1 })
decrease = Mutation("openui_mutation", { key: "counter", value: counter - 1 })
resetCounter = Mutation("openui_mutation", { key: "counter", value: 0 })
```

### Objects: update a field, toggle a boolean, and restore defaults

Every Mutation supplies the complete next object. The theme update carries
forward `notifications` and `language`; omitted fields would be removed.
Restoring defaults here writes those values to storage explicitly.

```text
root = Column([Text("Theme: " + preferences.theme), Text(preferences.notifications ? "Notifications on" : "Notifications off"), Buttons([Button("Dark theme", Action([@Run(useDarkTheme), @Run(preferences)])), Button("Toggle notifications", Action([@Run(toggleNotifications), @Run(preferences)])), Button("Reset preferences", Action([@Run(resetPreferences), @Run(preferences)]))])])
preferences = Query("openui_query", { key: "preferences" }, { theme: "light", notifications: true, language: "en" })
useDarkTheme = Mutation("openui_mutation", { key: "preferences", value: { theme: "dark", notifications: preferences.notifications, language: preferences.language } })
toggleNotifications = Mutation("openui_mutation", { key: "preferences", value: { theme: preferences.theme, notifications: !preferences.notifications, language: preferences.language } })
resetPreferences = Mutation("openui_mutation", { key: "preferences", value: { theme: "light", notifications: true, language: "en" } })
```

### Lists: add, edit, toggle, delete, and apply bulk changes

Addition uses `@Append(tasks.items, newItem)`, with no fixed list capacity.
Append adds exactly one item: `@Append([1], [2, 3])` returns `[1, [2, 3]]`, not
`[1, 2, 3]`. Numeric IDs come from the current maximum plus one, with an empty
list starting at one. Deleting the largest ID allows it to be reused later. Use a host-owned ID strategy if identities must
remain unique across deletions, scopes, or concurrent writers.

Click **New task**, enter a title, then **Add**. The empty draft has an explicit
empty Action, so it neither saves nor sends a conversation request. The form
closes after Mutation and Query refresh; reopening mounts a fresh input.
Click **Edit** on a row before saving, toggling, or deleting it in the editor.

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

The row template and its selection Action stay inline in `@Each`, where `task`
is in scope. TextField names match their `$state` keys exactly. Selection and
saving use separate actions: Mutation arguments read the state snapshot that
created the triggering action, so `@Set($selectedId, task.id)` followed by a
Mutation in that same Action would still read the previous selection.

The clear operation saves an empty list; it does not delete the Query resource
or restore its seed items. Keep seed data in Query defaults. To return to the
original defaults without a saved override, remove the scope's saved snapshot
through the host storage adapter and refresh or reopen the artifact.

### Views: search, filter, sort, and aggregate without writing

Derived views leave the original Query data unchanged. Search uses a
case-sensitive substring match. `@Sort` returns a sorted view, and the direction
is explicitly bound through `@Set`. Counts and totals are computed from the
Query arrays rather than stored as redundant counters.

```text
root = Column([TextField("Search title", $search, "shortText", null, null, "$search"), Buttons([Button($onlyOpen ? "Show all" : "Show open", Action([@Set($onlyOpen, !$onlyOpen)])), Button("Reverse sort", Action([@Set($direction, $direction == "asc" ? "desc" : "asc")]))]), Text(@Count(visible) + " visible / " + @Count(tasks.items) + " total"), Text(@Count(@Filter(tasks.items, "done", "==", false)) + " open"), Text("Points: " + @Sum(tasks.items.points) + "; average: " + @Round(@Avg(tasks.items.points), 1)), List(@Each(visible, "task", Text(task.title + " (" + task.points + " points)")), null, "vertical", "stretch", "s", false)])
$search = ""
$onlyOpen = false
$direction = "asc"
tasks = Query("openui_query", { key: "tasks" }, { items: [{ id: 1, title: "Plan release", done: false, points: 3 }, { id: 2, title: "Review changes", done: true, points: 2 }, { id: 3, title: "Write tests", done: false, points: 5 }] })
visible = @Sort(@Filter($onlyOpen ? @Filter(tasks.items, "done", "==", false) : tasks.items, "title", "contains", $search), "title", $direction)
```

`tasks.items.points` projects the numeric field into an array. Other available
aggregates include `@Min`, `@Max`, `@First`, and `@Last`. Use a Mutation only when
the transformed data itself should be saved, then refresh the source Query.

### Loading, failures, and concurrent edits

Show `change.status == "loading"` while a Mutation is running and
`change.status == "error"` on failure, replacing `change` with its statement
name. Hide conflicting action controls while saving, as in the Todo List demo.
Keep Query refresh and draft reset after `@Run(change)` so a rejected write does
not claim success or discard the user's input. Initialization and reads do not
save defaults; invalid JSON or storage errors must reject rather than silently
fall back to a model request.

Actions evaluate values from their triggering render snapshot. Multiple Mutations
in one Action do not form a transaction or automatically chain their computed
values. Combine related edits into one complete replacement. Use a separate
host tool with server-side concurrency control when the operation requires
atomic appends or increments across clients, or conflict detection. The pure
`@Append` expression does not provide ID generation or concurrency control.

For prompt configuration, see [System prompts](./system-prompts.md). For the
renderer lifecycle and `toolProvider`, see [Overview and architecture](./overview.md).
