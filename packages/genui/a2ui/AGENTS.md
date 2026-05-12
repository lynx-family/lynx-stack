# a2ui (packages/genui/a2ui)

This package (`@lynx-js/a2ui-reactlynx`) is a **headless** ReactLynx
renderer for the A2UI v0.9 protocol.

## How It Works (High Level)

The package is split into three independently composable layers:

- **Store layer** (`src/store/`) — pure data logic. Owns the protocol
  message buffer, surface state machine, signal-backed data model, and
  per-component resources. No React.
- **React layer** (`src/react/`) — `<A2UI>` / `<A2UIRenderer>` and the
  hooks (`useAction`, `useDataBinding`, `useCatalog`) that turn the
  store's surface state into a ReactLynx tree.
- **Catalog layer** (`src/catalog/`) — built-in components plus the
  `defineCatalog` API consumers use to compose their per-instance
  catalog (no global registry).

In short: the developer's IO module pushes raw v0.9 messages into a
`MessageStore`. `<A2UI>` subscribes, owns a `MessageProcessor` that
turns the stream into surface state, and renders via the catalog the
consumer provided.

## Architecture & Data Flow

Core pieces:

- `MessageStore` (`src/store/MessageStore.ts`)
  - Append-only buffer of raw protocol messages.
  - `useSyncExternalStore`-friendly `subscribe` / `getSnapshot` API.
  - The developer's transport (fetch / SSE / WebSocket / in-process
    mock) calls `store.push(msg)` — the store is intentionally dumb
    about protocol semantics.
- `MessageProcessor` (`src/store/MessageProcessor.ts`)
  - Owns all `Surface` instances.
  - Applies `createSurface` / `updateComponents` / `updateDataModel` /
    `deleteSurface` into surface state.
  - Emits typed update events (`beginRendering`, `surfaceUpdate`,
    `deleteSurface`) consumed by the React layer.
  - `dispatch({ userAction })` fans out to `onEvent` listeners.
- `Resource` (`src/store/Resource.ts`)
  - `pending` / `success` / `error` state machine. Snapshot reference
    changes on every transition so `useSyncExternalStore` doesn't bail
    out on `pending → error`.
  - One per surface root + per component instance.
- `SignalStore` (`src/store/SignalStore.ts`)
  - `@preact/signals` wrapper used as the per-surface data model
    (JSON-pointer-style paths).
- `<A2UI>` (`src/react/A2UI.tsx`)
  - All-in-one renderer. Per-mount `MessageProcessor`. Subscribes to
    the developer-supplied `MessageStore`, processes new tail messages
    on each render, and renders the most recent surface.
  - Wires `processor.onEvent` → the consumer's `onAction` prop.
- `<A2UIRenderer>` / `NodeRenderer` (`src/react/A2UIRenderer.tsx`)
  - Subscribes to a `Resource` and renders either:
    - `beginRendering`: mounts the surface root resource.
    - `surfaceUpdate`: re-renders a single component node.
    - `deleteSurface`: unmounts.
  - Used internally by `<A2UI>`; not part of the public surface.
- `defineCatalog` (`src/catalog/defineCatalog.ts`)
  - Builds the runtime catalog the renderer uses. Inputs can mix bare
    components, `[component, manifest]` tuples, and already-resolved
    entries from `mergeCatalogs`.

## Rendering Model

- Each protocol component instance references children via IDs (e.g.
  `child: "text-1"`, `children: ["a","b"]`).
- Catalog components render their child IDs by calling `<NodeRenderer>`
  for each child against the same surface.
- Unknown component tags log a warning (once per tag) and render `null`.

## Data Binding

- A binding is `{ path: string }` and resolves against
  `Surface.store` (a `SignalStore`).
- `useResolvedProps` (`src/react/useDataBinding.ts`) resolves bound
  props into concrete values and keeps them up to date via
  `@preact/signals`.
- Relative paths resolve against the component's `dataContextPath`
  (used heavily for templates / repeated structures).

## Template Expansion (Dynamic Children)

- When `updateComponents` contains a "templated children" placeholder,
  `MessageProcessor` stores `__template` metadata on the component.
- When `updateDataModel` updates the template's data path, the
  processor:
  - reads the data at the path,
  - clones the template subtree via `cloneComponentTree`,
  - rewrites child IDs and sets `dataContextPath` to an item-specific
    scope,
  - sets `children` to the generated concrete IDs.

This is why some components can appear/disappear when only the data
model changes.

## Action Dispatch

User interactions are reported as `userAction` events:

- Catalog components call `sendAction(action)` (passed in through the
  internal renderer plumbing).
- `useAction` (`src/react/useAction.ts`) resolves dynamic values
  (bindings / function calls) against `Surface.store`, builds a
  `UserActionPayload`, and calls `processor.dispatch({ userAction })`.
- `<A2UI>` listens to `processor.onEvent` and forwards to the
  developer's `onAction` prop. Responses (if any) come back as new
  protocol messages the developer pushes into the same `MessageStore`.

## What To Edit

- `src/catalog/*`: built-in UI components (also drives schema
  generation).
- `src/store/*`: protocol-side data layer (buffer, processor,
  resources, signals).
- `src/react/*`: ReactLynx renderer + hooks.

## Build

Run from repo root:

```bash
pnpm -F @lynx-js/a2ui-reactlynx build
```

Notes:

- The package's `build` script runs the
  `@lynx-js/a2ui-catalog-extractor` to produce
  `dist/catalog/<Name>/catalog.json` manifests.
- The root `tsc --build` (registered as `//#build`) is what produces
  `dist/<Name>/index.{js,d.ts}` for each catalog component (project
  references).

## Catalog Schema Generation

The build generates JSON schemas for catalog components:

- Tool: `@lynx-js/a2ui-catalog-extractor` (TypeDoc-driven).
- Inputs: `src/catalog/<Name>/index.tsx` files annotated with
  `@a2uiCatalog <Name>` JSDoc tags on the props interface.
- Outputs: `dist/catalog/<Name>/catalog.json`.

Constraints:

1. The component folder name must match the function declaration name
   in `index.tsx` (e.g. `src/catalog/Button/index.tsx` exports
   `function Button(...) { ... }`).
2. Framework-level props (`GenericComponentProps`) are intentionally
   excluded from the emitted schema.
3. Schema output is build output — don't commit `dist/`.

## Adding A New Catalog Component

When adding `src/catalog/<Name>/index.tsx`:

1. Ensure the component function is named `<Name>` (matches folder
   name).
2. Annotate the props interface with `@a2uiCatalog <Name>` so the
   extractor picks it up.
3. Re-export the component from `src/catalog/index.ts`.
4. Add `./catalog/<Name>` and `./catalog/<Name>/catalog.json` entries
   to the `exports` map in `package.json`.
5. Run `pnpm -F @lynx-js/a2ui-reactlynx build` and confirm
   `dist/catalog/<Name>/catalog.json` is generated.
