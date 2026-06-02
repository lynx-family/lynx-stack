# Overview and architecture

This page explains what `@lynx-js/genui/a2ui` is, the mental model behind
it, and how a server message becomes a rendered UI on the client. Read it
after the [quick start](../README.md) when you want to understand which
part of the stack owns each responsibility — and why the package is shaped
the way it is.

## What this package is

`@lynx-js/genui/a2ui` is the ReactLynx **client runtime** for the A2UI
v0.9 protocol. It consumes validated server-to-client JSON messages and
renders trusted ReactLynx components inside your app.

It is deliberately a renderer and nothing more. The package does **not**:

- host an Agent or call an LLM,
- own a backend route or chat shell,
- decide _what_ to render — that is the Agent's job.

Your app owns the transport layer and pushes messages into the renderer.
Use this package when you already have, or plan to build, an Agent service
that returns A2UI messages.

## The mental model

If you have written React, the shift is small but important:

- In **React**, your code chooses components and passes props.
- In **A2UI**, an _Agent_ chooses from a component catalog that _your app_
  publishes, and sends data describing which approved component to render
  and with what props.

The model never ships executable code. It selects a `component` name and a
prop bag from a contract you defined up front. The client looks that name up
in the catalog and renders the real ReactLynx component you registered.

```text
Agent output (data, not code):          Your catalog (code, trusted):
  { component: "Card",                     Card   -> <Card>   (you wrote this)
    child: "t1" }                          Text   -> <Text>   (you wrote this)
  { component: "Text", id: "t1",
    text: "Hello" }                      Result: <Card><Text>Hello</Text></Card>
```

The result is not arbitrary generated markup. It is a ReactLynx UI tree
assembled from a trusted catalog — which is what makes generated UI safe to
mount in a production app. An Agent can only reach the components and
functions you put in the catalog; anything else it emits renders nothing.

## The end-to-end picture

A2UI is a round trip between a server that decides and a client that
renders. This package is everything inside the **Client** box below.

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

1. The user prompts, or taps something in already-rendered UI.
2. Your **transport adapter** sends that to your **Agent service**.
3. The Agent calls a model with the A2UI system prompt and your catalog
   contract, validates the output, and returns A2UI messages.
4. Your adapter writes those messages into a `MessageStore`.
5. `<A2UI>` consumes them, renders the active surface, and forwards any
   user actions through `onAction` — which loops back to step 2.

Because the loop is just "push messages in, get actions out," the transport
can be REST, SSE, WebSocket, or an in-process mock. The renderer does not
care how messages arrive.

## Who owns what

The package draws a hard line between what it provides and what your
application provides. Keeping that line crisp is the reason the runtime
stays transport-agnostic and the catalog stays explicit.

| Piece             | Runs in                  | Owner            | Responsibility                                                                                                                                |
| ----------------- | ------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent service     | Server                   | Your application | Turns prompts and client actions into validated A2UI message arrays. Prompts the model with the same catalog contract the client renders.     |
| Transport adapter | Client shell             | Your application | Sends prompts/actions to the Agent over REST/SSE/WebSocket, then writes the returned messages into a `MessageStore`.                          |
| `MessageStore`    | Client                   | This package     | Stores raw A2UI messages in arrival order and notifies subscribers. It does not parse or interpret the protocol.                              |
| `<A2UI>`          | Client                   | This package     | Owns a `MessageProcessor` per mount, consumes new messages, renders the active surface, and forwards generated UI actions through `onAction`. |
| Catalog API       | Client + Agent handshake | This package     | Maps protocol component/function names to local implementations and optional JSON schemas. Compose it with `defineCatalog` and friends.       |
| Built-ins         | Client                   | This package     | A2UI v0.9 basic-catalog component renderers, per-component JSON-Schema manifests, and client-side basic-catalog function implementations.     |
| `genui a2ui`      | Build / setup time       | GenUI CLI        | Generates custom catalog artifacts and A2UI system prompts. Not required when both Agent and renderer use the built-in basic catalog.         |

A useful way to remember it: **the server decides, the client renders, and
the catalog is the contract they agree on.** The catalog is the one piece
that lives on both sides of the wire — your client registers
implementations; your Agent receives the serialized schema during the
handshake.

## Inside the client: how a message becomes UI

`<A2UI>` is an all-in-one front door, but underneath it the package is three
independently composable layers. Understanding the path a message takes
through them makes the renderer's behavior — and its lifecycle gotchas —
predictable.

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

- **Store layer** (`@lynx-js/genui/a2ui/store`) — pure data logic, no
  React. The `MessageStore` is an append-only buffer with a
  `useSyncExternalStore`-friendly `subscribe` / `getSnapshot` API. Your
  transport calls `store.push(msg)`; the store stays intentionally dumb
  about protocol semantics.
- **`MessageProcessor`** — the protocol brain. It owns every `Surface`,
  applies `createSurface` / `updateComponents` / `updateDataModel` /
  `deleteSurface` into surface state, and emits typed events
  (`beginRendering`, `surfaceUpdate`, `deleteSurface`) for the React layer
  to consume. `dispatch({ userAction })` fans actions out to listeners.
- **`Resource`** — a `pending → success → error` state machine, one per
  surface root and per component instance. Its snapshot reference changes
  on every transition so `useSyncExternalStore` never bails out of a
  `pending → error` update.
- **`SignalStore`** — a `@preact/signals` wrapper used as the per-surface
  data model, addressed with JSON-pointer-style paths.
- **React layer** (`@lynx-js/genui/a2ui/react`) — `<A2UI>` plus
  `NodeRenderer` and the hooks (`useAction`, `useDataBinding`,
  `useResolvedProps`, `useChecks`) that turn surface state into a ReactLynx
  tree.

A few runtime behaviors worth knowing because they explain things you will
see while building:

- **Children by reference.** A component instance references children by id
  (`child: "text-1"` or `children: ["a", "b"]`). Catalog components render
  their child ids by delegating to `<NodeRenderer>` for the same surface.
- **Data binding.** A bound prop is `{ path: string }` resolved against the
  surface's `SignalStore`. Relative paths resolve against the component's
  `dataContextPath`, which is what makes templates and repeated lists work.
- **Template expansion.** When `updateComponents` carries a "templated
  children" placeholder, the processor stores `__template` metadata. When a
  later `updateDataModel` fills the bound path, it clones the template
  subtree per item, rewrites child ids, and scopes each clone's
  `dataContextPath`. This is why components can appear or disappear when
  only the data model changes.
- **Actions loop back as messages.** A tap calls `sendAction`; `useAction`
  resolves any dynamic values, builds a `UserActionPayload`, and dispatches
  it. `<A2UI>` forwards it to your `onAction`. Responses, if any, return as
  new protocol messages that you push into the same `MessageStore`.
- **Unknown components fail soft.** A `component` name not in the catalog
  logs a warning once per tag and renders `null`, rather than throwing.

## Package contents

The building blocks you compose against:

- **`<A2UI>`** — the all-in-one component. It owns a `MessageProcessor`,
  subscribes to a developer-supplied `MessageStore`, and renders the most
  recent surface.
- **`MessageStore`** — an append-only buffer of raw protocol messages you
  push into from any transport: fetch, SSE, WebSocket, or an in-process
  mock.
- **Catalog API** — `defineCatalog`, `mergeCatalogs`, `serializeCatalog`,
  `resolveCatalog`, and `defineFunction`. There is no global component
  registry; every consumer composes the component and function entries it
  wants.
- **Built-in components** — 20 A2UI v0.9 basic-catalog renderers (`Text`,
  `Image`, `Button`, `Row`, `Column`, `List`, `Loading`, `Card`, `Modal`,
  `Divider`, `Icon`, `CheckBox`, `ChoicePicker`, `DateTimeInput`,
  `LineChart`, `PieChart`, `RadioGroup`, `Slider`, `TextField`, and
  `Tabs`). See the [catalog guide](./catalog-guide.md) for what each one
  does.
- **Per-component manifests** — `catalog/<Name>/catalog.json`, the
  JSON-Schema descriptions used during Agent handshakes.
- **`basicFunctions`** — A2UI v0.9 basic-catalog client function entries,
  ready to spread into your `catalogs` array.

## Exports

The package is split into subpaths so you import only what you use.

| Import                                            | What you get                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@lynx-js/genui/a2ui`                             | The main surface: `<A2UI>`, `createMessageStore`, the catalog API, every built-in component, `basicFunctions`, and protocol types. |
| `@lynx-js/genui/a2ui/catalog`                     | The catalog API and built-ins again, as a tree-shake-friendly subpath.                                                             |
| `@lynx-js/genui/a2ui/catalog/<Name>`              | A single built-in component (e.g. `.../catalog/Text`).                                                                             |
| `@lynx-js/genui/a2ui/catalog/<Name>/catalog.json` | That component's JSON-Schema manifest for the handshake.                                                                           |
| `@lynx-js/genui/a2ui/store`                       | The pure data layer: `MessageStore`, `MessageProcessor`, `Resource`, `SignalStore`, and the payload normalizers.                   |
| `@lynx-js/genui/a2ui/react`                       | The custom-component contract: `NodeRenderer`, `useAction`, `useDataBinding`, `useResolvedProps`, and `useChecks`.                 |
| `@lynx-js/genui/a2ui/functions`                   | `basicFunctions` and the `registerBasicFunctions` escape hatch.                                                                    |
| `@lynx-js/genui/a2ui/styles/theme.css`            | Optional default CSS tokens for `.a2ui-light` and `.a2ui-dark`.                                                                    |

Most apps only ever import from `@lynx-js/genui/a2ui`. Reach for `/store` and
`/react` when you build custom catalog components or your own renderer.

## `<A2UI>` props and lifecycle

`<A2UI>` takes two required props and a set of optional render hooks.

| Prop                | Type                                     | Required | Purpose                                                                                                 |
| ------------------- | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `messageStore`      | `MessageStore`                           | yes      | The raw-message buffer your transport pushes into. `<A2UI>` subscribes and processes new tail messages. |
| `catalogs`          | `readonly CatalogInput[]`                | yes      | The components and function entries the renderer is allowed to instantiate.                             |
| `onAction`          | `(action: UserActionPayload) => void`    | no       | Fired when a user action occurs in the tree. Forward to your Agent; push responses back into the store. |
| `className`         | `string`                                 | no       | Applied to the surface root view (`surface-${surfaceId}`). Handy for surface-level theme classes.       |
| `wrapSurface`       | `(children, { surfaceId }) => ReactNode` | no       | Wraps each surface so you can apply an outer theme shell or wrapper styles.                             |
| `renderEmpty`       | `() => ReactNode`                        | no       | Rendered before the first `beginRendering` arrives. Defaults to nothing.                                |
| `renderFallback`    | `() => ReactNode`                        | no       | Rendered while the active resource is pending. Defaults to the built-in `<Loading>`.                    |
| `renderError`       | `(err: unknown) => ReactNode`            | no       | Rendered when the active resource fails.                                                                |
| `renderUnsupported` | `(info) => ReactNode`                    | no       | Rendered for an unsupported component or data syntax.                                                   |

Lifecycle notes that save debugging time:

- **One processor per mount.** `<A2UI>` creates its `MessageProcessor`
  (surfaces, signals, resources) once per mount. Passing a _different_
  `messageStore` instance later does **not** reset internal state. To start
  a fresh session or turn, mount with a different `key` derived from your
  turn/session id: `<A2UI key={turnId} messageStore={turnStore} … />`.
- **`onAction` is fire-and-forget.** The renderer never awaits it. Your
  Agent pushes follow-up messages back into the same `MessageStore` to
  update the UI.
- **`className` vs `wrapSurface`.** Both can drive theme switching;
  `className` styles the surface root, `wrapSurface` adds an outer wrapper.
  Choose the layer that matches your styling strategy.

## Where to go next

- [Catalogs, built-ins, and custom components](./catalog-guide.md) — compose
  the contract, add manifests, and register your own components.
- [Open the A2UI playground](https://lynxjs.org/a2ui) — try it live.
