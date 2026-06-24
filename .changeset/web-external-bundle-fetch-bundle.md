---
"@lynx-js/web-core": minor
---

Support `lynx.fetchBundle` and `lynx.loadScript` for async external bundles on the web platform.

`@lynx-js/externals-loading-webpack-plugin` (via `@lynx-js/external-bundle-rsbuild-plugin`) can now load external bundles at runtime on web. Both APIs are available on the `lynx` object in the main-thread and background JS realms. An external bundle reuses the card's own chunk machinery rather than custom sections: its main-thread chunk rides the `LepusCode` section (loaded in the mts realm via `lepusCodeUrls`) and its background chunk rides the `Manifest` section (loaded in the bts worker via `updateBTSChunk` → `templateCache`), while its pre-processed style section is applied globally through the existing wasm style engine. The background thread now requires `@lynx-js/lynx-core` >= 0.1.4, whose `lynx.loadScript` runs the loaded section's init.

Web binary external bundles are produced by `@lynx-js/lynx-bundle-rslib-config` with `target: 'web'`.

Only the async usage is supported (`async: true`); the synchronous `promise.wait()` usage is not available on web.
