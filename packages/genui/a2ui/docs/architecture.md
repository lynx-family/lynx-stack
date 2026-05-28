# Architecture and exports

This page is for developers who already finished the quick start and want to
understand which part of the A2UI stack owns each responsibility.

## Responsibilities

| Piece             | Runs in                    | Responsibility                                                                                                                                                                                      |
| ----------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent service     | Server                     | Turns user prompts and client actions into validated A2UI message arrays. It should prompt the model with the same catalog contract that the client can render.                                     |
| Transport adapter | Client shell               | Sends prompts/actions to the Agent service over REST, SSE, WebSocket, or another transport, then writes returned messages into a `MessageStore`.                                                    |
| `MessageStore`    | Client                     | Stores raw A2UI protocol messages in arrival order and notifies subscribers. It does not parse or interpret the protocol.                                                                           |
| `<A2UI>`          | Client                     | Owns a `MessageProcessor` per mount, consumes new messages from `MessageStore`, renders the active surface, and forwards generated UI actions through `onAction`.                                   |
| Catalog API       | Client and Agent handshake | Maps protocol component/function names to local implementations and optional JSON schemas. Use `defineCatalog`, `mergeCatalogs`, `serializeCatalog`, and `defineFunction` to compose that contract. |
| Built-ins         | Client                     | Provides A2UI v0.9 basic catalog component renderers, JSON-Schema manifests, and client-side basic-catalog function implementations.                                                                |
| `genui a2ui`      | Build/setup time           | Generates custom catalog artifacts and system prompts. It is not required when both the Agent and renderer use the built-in basic catalog.                                                          |

## Package contents

- `<A2UI>`: all-in-one component that owns a `MessageProcessor`, subscribes
  to a developer-supplied `MessageStore`, and renders the most recent
  surface.
- `MessageStore`: an append-only buffer of raw protocol messages the
  developer pushes into from any IO transport, such as fetch, SSE,
  WebSocket, or an in-process mock.
- `defineCatalog`, `mergeCatalogs`, `serializeCatalog`, and
  `defineFunction`: the catalog API. There is no global component catalog;
  every consumer composes the component and function entries it wants.
- `catalog/<Name>`: built-in component renderers (`Text`, `Image`, `Row`,
  `Column`, `List`, `Card`, `Modal`, `Button`, `Divider`, `Icon`,
  `CheckBox`, `ChoicePicker`, `DateTimeInput`, `LineChart`, `PieChart`,
  `RadioGroup`, `Slider`, `TextField`, and `Tabs`).
- `catalog/<Name>/catalog.json`: per-component JSON-Schema manifests for
  Agent handshakes.
- `basicFunctions`: A2UI v0.9 basic-catalog client function entries, ready
  to spread into `catalogs`.

## Exports

- `@lynx-js/genui/a2ui`: `<A2UI>`, `createMessageStore`,
  `defineCatalog`, built-ins, basic functions, and protocol types.
- `@lynx-js/genui/a2ui/catalog`: re-exports of the catalog API and
  built-ins for tree-shake-friendly subpath access.
- `@lynx-js/genui/a2ui/catalog/<Name>`: import a single built-in.
- `@lynx-js/genui/a2ui/catalog/<Name>/catalog.json`: import the
  per-component manifest.
- `@lynx-js/genui/a2ui/store`: `MessageStore`, `MessageProcessor`,
  `Resource`, payload normalizers — the pure data layer.
- `@lynx-js/genui/a2ui/react`: helpers used by custom catalog
  components, including `NodeRenderer`, `useAction`, `useDataBinding`, and
  `useChecks`.
- `@lynx-js/genui/a2ui/functions`: basic-catalog function entries and
  registration helpers.
- `@lynx-js/genui/a2ui/styles/theme.css`: optional default CSS tokens
  for `.a2ui-light` and `.a2ui-dark`.

## `<A2UI>` lifecycle notes

- It owns its own `MessageProcessor` per mount. Passing a different
  `messageStore` instance does not reset internal state; use a `key` derived
  from your turn or session id when you want a fresh session.
- `onAction` is fire-and-forget. The renderer does not wait for a response.
  Your Agent pushes follow-up messages back into the same `MessageStore`.
- `className` applies to the surface root view (`surface-${surfaceId}`).
- `wrapSurface` applies an outer wrapper around the rendered surface.
- `className` and `wrapSurface` can both support theme switching; choose the
  layer that matches your styling strategy.
