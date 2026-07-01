---
applyTo: "packages/genui/openui/**"
---

When maintaining `packages/genui/openui`, treat OpenUI v0.5 rendering as driven by raw response text through `<OpenUiRenderer response={...}>`. Keep `<OpenUiRenderer result={...}>` only as the legacy pre-parsed/static compatibility path; v0.5 features such as `$` state declarations, `Query`, `Mutation`, and multi-step `Action` plans need the parser/evaluator runtime created by `useOpenUIState`.

When changing exported OpenUI runtime APIs, refresh both API reports with `pnpm turbo api-extractor --filter @lynx-js/genui-openui -- --local` and `pnpm turbo api-extractor --filter @lynx-js/genui -- --local`, because `@lynx-js/genui` re-exports the OpenUI surface.

When adding OpenUI v0.5 cases to `packages/genui/playground`, keep raw protocol examples limited to components supported by `packages/genui/openui/src/catalog` unless the same change extends the catalog. Query and Mutation examples need matching mock tools in `packages/genui/playground/lynx-src/openui/App.tsx` so `/render.html` previews exercise the runtime path instead of staying on default or unresolved values.

When exposing OpenUI prompt generation for server-side agents, keep prompt-only component libraries headless: mirror the ReactLynx component names and Zod schemas but use null renderers so Node routes can build system prompts without importing ReactLynx or Lynx UI runtime modules.

When adding a built-in component under `packages/genui/openui/src/catalog`, update `src/catalog/index.ts`, the `DEFAULT_COMPONENTS` and `DEFAULT_COMPONENT_GROUPS` arrays in `src/core/createLibrary.tsx`, and `src/core/renderer.css` in the same change. Otherwise the component may be importable but absent from the default OpenUI library or render without its intended Lynx styles.

When handling `$` state declarations in `useOpenUIState`, remember that streaming parser output can briefly contain partial string defaults such as `"h"` from an unfinished URL. During streaming, declaration defaults should be treated as transient parser output and synchronized forward; after streaming, preserve the normal store semantics that avoid clobbering existing user state.

When styling OpenUI `Image` variants, remember that Lynx for Web maps `<image auto-size>` to `x-image[auto-size]` with `display: contents`; the shadow `<img>` inherits width and height from the host class. Give image variants concrete width and height values, not only `max-width` or `max-height`, or remote images can collapse to an invisible box even when `src` is valid.
