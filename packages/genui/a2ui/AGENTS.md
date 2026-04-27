# a2ui (packages/genui/a2ui)

This package (`@lynx-js/a2ui-reactlynx`) is a ReactLynx-oriented component library inspired by Google A2UI.

## How It Works (High Level)

This package is primarily a renderer + state/runtime for the A2UI v0.9 protocol:

- A2UI messages (e.g. `createSurface`, `updateComponents`, `updateDataModel`) are processed by `src/core/processor.ts` into local state (`Surface`).
- Each `Surface` owns:
  - `components`: a map of v0.9 component instances (`ComponentInstance`)
  - `resources`: per-component `Resource` objects used to drive incremental rendering
  - `store`: a `SignalStore` for data bindings (JSON-pointer-like paths)
- `src/core/A2UIRender.tsx` renders a tree by looking up component instances and delegating to the registered ReactLynx component implementation.

In short: protocol messages update a surface model; resources notify; `A2UIRender` turns the model into UI.

## Architecture & Data Flow

Core pieces:

- `processor` (`src/core/processor.ts`)
  - Owns all `Surface` instances.
  - Applies `updateComponents` into `surface.components` + creates `surface.resources`.
  - Applies `updateDataModel` into `surface.store`, and may expand templates into concrete components.
- `BaseClient` (`src/core/BaseClient.ts`)
  - Streams server output (SSE) and normalizes payloads into v0.9 message arrays.
  - Feeds messages into `processor.processMessages`.
  - Listens to processor updates and completes `Resource` objects.
- `A2UIRender` (`src/core/A2UIRender.tsx`)
  - Subscribes to `Resource` completion/update and renders either:
    - `beginRendering`: mounts the surface root resource
    - `surfaceUpdate`: renders a single component node
    - `deleteSurface`: unmounts
- `componentRegistry` (`src/core/ComponentRegistry.ts`)
  - Maps protocol `component` names (e.g. `"Button"`) to actual ReactLynx renderers.
  - Catalog modules register themselves by side effect when imported.

## Rendering Model

- Each protocol component instance references children via IDs (e.g. `child: "text-1"`, `children: ["a","b"]`).
- Catalog components typically render their child ID by calling `A2UIRender` on the child `Resource`.
- Unknown component tags will log a warning and render `null`.

## Data Binding

Data binding is path-based:

- A binding is usually `{ path: string }` and resolves against the `Surface.store`.
- `useResolvedProps` (`src/core/useDataBinding.ts`) resolves bound props into concrete values, and keeps them up to date via `@preact/signals`.
- Relative paths are resolved against the component's `dataContextPath` (used heavily for templates / repeated structures).

## Template Expansion (Dynamic Children)

To support repeated UI from data:

- When `updateComponents` contains a "templated children" placeholder, `processor` stores internal metadata on the component (`__template`).
- When `updateDataModel` updates the template data path, `processor`:
  - reads the data at the template path
  - clones the template component subtree using `cloneComponentTree`
  - rewrites child IDs and sets `dataContextPath` to an item-specific scope
  - updates `children` to the generated concrete IDs

This is why some components can appear/disappear when only the data model changes.

## Action Dispatch

User interactions are reported as `userAction` events:

- Catalog components call `sendAction(action)` passed from `A2UIRender`.
- `useAction` (`src/core/useAction.ts`) converts v0.9 `Action` into a `UserActionPayload`:
  - resolves dynamic values (bindings / function calls) from `Surface.store`
  - calls `processor.dispatch({ userAction })`
- The "host" (app/client) is responsible for handling `processor.onEvent` and returning new messages.

## What To Edit

- `src/catalog/*`: UI catalog components (also used for schema generation).
- `src/core/*`: A2UI runtime/rendering and component registry.
- `src/chat/*`: Chat-related helpers.
- `src/utils/*`: Shared utilities.

## Build

Run from repo root:

```bash
pnpm -C packages/genui/a2ui build
```

Notes:

- Build outputs go to `dist/` (including `dist/catalog/...` schemas).

## Catalog Schema Generation

The build generates JSON schemas for catalog components:

- Script: `tools/catalog_generator.ts`
- Inputs: `src/catalog/*/index.tsx`
- Outputs: `dist/catalog/<ComponentName>/catalog.json`

Important constraints:

1. Component folder name must match the function declaration name in `index.tsx`.
   - Example: `src/catalog/Button/index.tsx` should export `function Button(...) { ... }`.
2. Framework-level props are intentionally excluded (e.g. `GenericComponentProps` / `ComponentProps`).
3. Schema output is written under `dist/` and should be treated as build output.

## Adding A New Catalog Component

When adding `src/catalog/<Name>/index.tsx`:

1. Ensure the component function is named `<Name>` (matches folder name).
2. Add `src/catalog/<Name>.ts` (follow the existing pattern).
3. Export it from `src/catalog/all.ts` (this file also triggers registration side effects).
4. Add `./catalog/<Name>` to the `exports` map in `package.json`.
5. Run `pnpm -C packages/genui/a2ui build` and confirm `dist/catalog/<Name>/catalog.json` is generated.
