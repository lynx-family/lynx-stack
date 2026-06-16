---
"@lynx-js/web-core": minor
---

Support `lynx.fetchBundle` and `lynx.loadScript` for async external bundles on the web platform.

`@lynx-js/externals-loading-webpack-plugin` (via `@lynx-js/external-bundle-rsbuild-plugin`) can now load external `.lynx.bundle` dependencies at runtime on web. Both APIs are available on the `lynx` object in the main-thread and background JS realms. Loading reuses the lazy-component machinery (`templateManager` + the runtime chunk wrapper that wraps each raw section), and an external bundle's pre-processed style section is applied globally through the existing wasm style engine.

The template decode worker now decodes binary custom sections, so web binary external bundles (produced by `@lynx-js/lynx-bundle-rslib-config` with `target: 'web'`) are consumable.

Only the async usage is supported (`async: true`); the synchronous `promise.wait()` usage is not available on web.
