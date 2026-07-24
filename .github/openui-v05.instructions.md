---
applyTo: "packages/genui/openui/**"
---

When maintaining `packages/genui/openui`, treat OpenUI v0.5 rendering as driven by raw response text through `<OpenUiRenderer response={...}>`. Keep `<OpenUiRenderer result={...}>` only as the legacy pre-parsed/static compatibility path; v0.5 features such as `$` state declarations, `Query`, `Mutation`, and multi-step `Action` plans need the parser/evaluator runtime created by `useOpenUIState`.

When changing exported OpenUI runtime APIs, refresh both API reports with `pnpm turbo api-extractor --filter @lynx-js/genui-openui -- --local` and `pnpm turbo api-extractor --filter @lynx-js/genui -- --local`, because `@lynx-js/genui` re-exports the OpenUI surface.

When adding OpenUI v0.5 cases to `packages/genui/playground`, keep raw protocol examples limited to components supported by `packages/genui/openui/src/catalog` unless the same change extends the catalog. Query and Mutation examples need matching mock tools in `packages/genui/playground/lynx-src/openui/App.tsx` so `/render.html` previews exercise the runtime path instead of staying on default or unresolved values.

When exposing OpenUI prompt generation for server-side agents, keep prompt-only component libraries headless: mirror the ReactLynx component names and Zod schemas but use null renderers so Node routes can build system prompts without importing ReactLynx or Lynx UI runtime modules.

When adding a built-in component under `packages/genui/openui/src/catalog`, update `src/catalog/index.ts`, the `DEFAULT_COMPONENTS` and `DEFAULT_COMPONENT_GROUPS` arrays in `src/core/createLibrary.tsx`, and the matching stylesheet under `packages/genui/openui/styles/catalog` in the same change. Import that stylesheet from the component source with a relative path that still works after TypeScript emits `dist/catalog/<Component>/index.jsx`, for example `../../../styles/catalog/Button.css`. Otherwise the component may be importable but absent from the default OpenUI library or render without its intended Lynx styles. Keep catalog CSS private to component source imports rather than exposing `openui/styles/catalog/*.css` as a public package entry.

When maintaining OpenUI styles, keep theme variables in `packages/genui/openui/styles/theme.css`; this is the only OpenUI stylesheet expected to be imported directly by playground/host entries. Keep shared Material Icons `@font-face` CSS in `packages/genui/openui/styles/material-icons.css`, and import it only from the Icon component alongside `../../../styles/catalog/Icon.css`.

Keep core renderer styles in `packages/genui/openui/src/core/renderer.css`, with `renderer.tsx` depending on `./renderer.css` directly. The package build should continue copying that file into `dist/core` for the emitted `renderer.jsx` relative import, but do not expose a package-level `openui/styles/renderer.css` entry.

Keep component styles in `packages/genui/openui/styles/catalog/*.css`, imported directly by the corresponding catalog component source. Do not add an aggregate `styles/index.css` entry, a `styles/core` directory, public catalog CSS exports, or public renderer CSS exports. Map OpenUI-specific CSS custom properties to Luna tokens such as `--canvas`, `--paper`, `--content`, `--line`, `--primary`, and `--secondary` with fallbacks, and make component rules consume `--openui-*` variables rather than hardcoded light/dark colors.

When handling `$` state declarations in `useOpenUIState`, remember that streaming parser output can briefly contain partial string defaults such as `"h"` from an unfinished URL. During streaming, declaration defaults should be treated as transient parser output and synchronized forward; after streaming, preserve the normal store semantics that avoid clobbering existing user state.

When a built-in input must update a declared `$` state value, give its `name` the exact state key including the `$` prefix, for example `name="$city"` for `$city`; top-level named fields and state declarations share the same store, and query evaluation unwraps the field value. A different name such as `city` is form state and cannot be copied into `$city` with an OpenUI `@Set` action because input actions expose no event-value expression. This bridge requires the v0.5 `response` runtime and no enclosing custom Form; input changes are immediate and not debounced, so a dependent Query runs on each change.

When styling OpenUI `Image` variants, remember that Lynx for Web maps `<image auto-size>` to `x-image[auto-size]` with `display: contents`; the shadow `<img>` inherits width and height from the host class. Give image variants concrete width and height values, not only `max-width` or `max-height`, or remote images can collapse to an invisible box even when `src` is valid.
