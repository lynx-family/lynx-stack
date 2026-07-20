# Overview and architecture

This page explains what `@lynx-js/genui/openui` is, how OpenUI Lang maps to a
trusted ReactLynx component tree, and what happens between a streamed Agent
response and the rendered UI.

## What this package is

`@lynx-js/genui/openui` is the ReactLynx **client runtime** for OpenUI Lang
v0.5. It combines the framework-agnostic parser and evaluator from
`@openuidev/lang-core` with a ReactLynx renderer and a built-in mobile component
library.

The package provides:

- `<OpenUiRenderer>` for raw or pre-parsed OpenUI input;
- `createOpenUiLibrary()` and 26 trusted component implementations;
- incremental parsing for model streams;
- reactive `$variables`, expression evaluation, and form state;
- `Query()`, `Mutation()`, and multi-step `Action([...])` execution;
- structured parser, runtime, render, and tool errors;
- prompt builders that describe the matching component contract to an Agent.

It does **not** host an Agent, call an LLM, define your network transport, or
provide backend tools. Your application owns those pieces.

## Quick start

Install the package and optional default theme in a ReactLynx app:

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

The simplest valid response is:

```text
root = Stack([message])
message = TextContent("Hello OpenUI")
```

OpenUI uses positional arguments. The parser maps them to named props in the
order of each component's Zod schema. Forward references are allowed, so the
root can refer to statements that appear later in the response.

## The mental model

In ordinary React, your source code chooses a component and passes props:

```tsx
<Card>
  <TextContent text='Hello' />
</Card>;
```

In OpenUI, the Agent writes the same intent as declarative assignments:

```text
root = Card([message])
message = TextContent("Hello")
```

The renderer never evaluates generated JavaScript. It parses the text against
the JSON Schema produced by your `Library`, turns valid component calls into an
element tree, and looks up each element's trusted ReactLynx implementation by
name. A component that is not in the Library cannot be rendered.

The Library is therefore the contract on both sides:

```text
Agent prompt                              ReactLynx client
Library signatures                       Library implementations
Stack(children, direction?, ...)   <──►   Stack -> trusted renderer
Text(text, variant?)               <──►   Text  -> trusted renderer
```

Keep the prompt Library and renderer Library aligned whenever you add or
override a component. A name or prop-order mismatch can produce text that the
client cannot validate.

## OpenUI Lang v0.5 in one minute

An OpenUI program contains one assignment per line. There are three statement
families:

| Statement | Example                                                            | Purpose                                               |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Component | `header = CardHeader("Orders")`                                    | Declares a renderable component.                      |
| State     | `$status = "open"`                                                 | Declares reactive client state and its default value. |
| Data      | `orders = Query("list_orders", { status: $status }, { rows: [] })` | Declares a read or write tool operation.              |

Expressions can contain primitives, arrays, objects, references, member access,
operators, ternaries, and built-ins such as `@Count(...)`. The renderer needs a
statement named `root`; by default its component must be `Stack` because that is
the default Library root.

State values are reactive. When `$status` changes, expressions that read it are
evaluated again and Queries whose arguments depend on it are refreshed.

```text
$status = "open"
orders = Query("list_orders", { status: $status }, { rows: [] })
root = Stack([summary, refresh])
summary = TextContent("Orders: " + @Count(orders.rows))
refresh = Button("Refresh", Action([@Run(orders)]), "secondary")
```

For the complete language grammar and built-ins, read the
[OpenUI Lang v0.5 specification](https://www.openui.com/docs/openui-lang/specification-v05).

## The end-to-end picture

OpenUI is a loop between an Agent that writes declarative UI and a client that
parses, evaluates, and renders it.

```text
       ┌──────────────── Your application ────────────────┐
user   │                                                  │
input ─┼─► Transport ──prompt/action──► Agent service     │
       │      ▲                              │             │
       │      │   accumulated OpenUI text    │             │
       │      └──────────────────────────────┘             │
       │      │                                            │
       │      ▼                                            │
       │ <OpenUiRenderer response={text}>                  │
       │      │                                            │
       │      ├─ parser ─► AST ─► evaluator ─► UI tree     │
       │      ├─ Store ($state + form state)               │
       │      └─ QueryManager ─► your toolProvider         │
       │                    │                               │
       │                    └─ onAction ─► host/transport ──┤
       └───────────────────────────────────────────────────┘
```

1. Your transport sends the user request to an Agent service.
2. The service calls a model with an OpenUI system prompt built from the same
   component contract the client supports.
3. The transport appends chunks to one accumulated `response` string and passes
   it to `<OpenUiRenderer>`.
4. The streaming parser validates completed statements and resolves references.
5. The runtime initializes state, evaluates expressions, and runs complete
   Queries through your `toolProvider`.
6. The renderer walks the evaluated root and mounts trusted ReactLynx
   components from the Library.
7. User interactions execute action steps. Host-facing actions leave through
   `onAction`; state and tool steps stay inside the runtime.

## Inside the client

The raw `response` path creates the complete v0.5 runtime:

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

Important runtime behavior:

- **Incremental parsing.** The parser caches completed statements while the
  accumulated response grows. Forward references become renderable when their
  targets arrive.
- **Stable Library.** Create the Library once with `useMemo` or outside the
  component. Changing its identity creates a new parser and can reset parsing
  work.
- **Streaming guard.** Pass `isStreaming` while generation is active. Query and
  mutation execution waits for stable output, and built-in interactions are
  disabled.
- **Reactive state.** `$variables` and form values live in one external Store.
  `onStateUpdate` can persist its snapshots; `$`-prefixed values in
  `initialState` hydrate reactive declarations.
- **Queries and mutations.** Queries execute when their statements are complete
  and re-run when referenced state changes. Mutations are registered but run
  only when an action calls `@Run(mutationRef)`.
- **Sequential actions.** `@Run`, `@Set`, `@Reset`, `@ToAssistant`, and
  `@OpenUrl` execute in order. A failed mutation stops the remaining steps.
- **Soft component failure.** An element whose component name is not registered
  renders nothing. `onError` receives other parse, evaluation, render, and tool
  failures after streaming settles.

## Who owns what

| Piece              | Runs in                 | Owner                      | Responsibility                                                                                            |
| ------------------ | ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Agent service      | Server                  | Your application           | Produces raw OpenUI Lang using the system prompt and component/tool contract.                             |
| Transport adapter  | Client shell            | Your application           | Streams accumulated response text, handles cancellation, and forwards conversation actions.               |
| `Library`          | Client + Agent contract | Shared                     | Names components, fixes positional prop order, provides JSON Schema, and maps names to trusted renderers. |
| Parser/evaluator   | Client                  | This package + `lang-core` | Parses statements, validates props, resolves state/data expressions, and reports structured errors.       |
| Store/QueryManager | Client                  | This package + `lang-core` | Owns reactive/form state and executes tool-backed Query/Mutation statements.                              |
| `<OpenUiRenderer>` | Client                  | This package               | Renders the evaluated root and wires state, tools, and actions to ReactLynx components.                   |
| `toolProvider`     | Client integration      | Your application           | Maps tool names to async functions or an MCP-compatible client.                                           |

## `<OpenUiRenderer>` props

Use the raw response form for all new integrations.

| Prop            | Type                                       | Required | Purpose                                                                  |
| --------------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| `response`      | `string \| null`                           | yes      | Accumulated raw OpenUI Lang text. Enables the v0.5 runtime.              |
| `library`       | `Library`                                  | yes      | Component schemas and trusted ReactLynx implementations.                 |
| `isStreaming`   | `boolean`                                  | no       | Marks partial model output and disables unstable interactions/tool work. |
| `onAction`      | `(event: ActionEvent) => void`             | no       | Receives assistant and URL actions that the host must handle.            |
| `onStateUpdate` | `(state: Record<string, unknown>) => void` | no       | Receives reactive/form state snapshots for persistence.                  |
| `initialState`  | `Record<string, unknown>`                  | no       | Hydrates `$variables` and form state.                                    |
| `onParseResult` | `(result: ParseResult \| null) => void`    | no       | Exposes the latest raw AST and parser metadata.                          |
| `toolProvider`  | function map, MCP-like client, or `null`   | no       | Executes tools referenced by Query/Mutation statements.                  |
| `queryLoader`   | `ReactNode`                                | no       | Replaces the default indicator while Queries are in flight.              |
| `onError`       | `(errors: OpenUIError[]) => void`          | no       | Receives deduplicated structured errors after streaming.                 |

`<OpenUiRenderer result={parseResult} library={library}>` remains available for
legacy/static callers. It can render a pre-parsed element tree and forward
simple actions, but it does not create the v0.5 QueryManager or fully execute
`@Run`, `@Set`, and `@Reset`. Do not use it for a new v0.5 integration.

## Tool providers

For local functions, pass a name-to-function map:

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

You may also pass an MCP-compatible object with
`callTool({ name, arguments })`. The runtime extracts structured MCP tool
results before expression evaluation. Missing tools and tool failures are
reported through `onError`.

## Exports

| Import                                   | What you get                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@lynx-js/genui/openui`                  | Renderer, Library helpers, parser/runtime exports, hooks, built-in components, and public types. |
| `@lynx-js/genui/openui/catalog`          | Tree-shake-friendly re-exports of the built-in component definitions.                            |
| `@lynx-js/genui/openui/prompt`           | Headless prompt Library, prompt builder, default prompt, and prompt-specific types.              |
| `@lynx-js/genui/openui/styles/theme.css` | Optional light/dark CSS custom-property tokens.                                                  |

Component styles, the core renderer stylesheet, and the Material Icons font are
implementation details imported by the relevant modules. Do not import private
files under `styles/catalog` or `dist/core`.

## Where to go next

- [Libraries, built-ins, and custom components](./library-guide.md)
- [System prompts](./system-prompts.md)
- [Open the OpenUI playground](https://lynx-stack.dev/genui/#/openui)
