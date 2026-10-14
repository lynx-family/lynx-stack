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
language has no array append builtin; insertion requires an appropriate host tool.
Values are computed from the render snapshot that triggered the action; concurrent
writes to the same Query from different windows use last-write-wins semantics.
The data tools entry has no renderer, catalog, browser, or native dependencies;
each host supplies storage, transport, and tool registration.

For prompt configuration, see [System prompts](./system-prompts.md). For the
renderer lifecycle and `toolProvider`, see [Overview and architecture](./overview.md).
