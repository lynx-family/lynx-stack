---
"@lynx-js/lynx-bundle-rslib-config": minor
---

Add a `web` encode target to `defineExternalBundleRslibConfig` (`encodeOptions.target: 'web'`).

When set, the external bundle is emitted as a web binary bundle (`<name>.web.bundle`, encoded via `@lynx-js/web-core/encode`) that the Lynx web platform can decode and load with `lynx.fetchBundle` / `lynx.loadScript`. For the web target, each section is routed to the bundle slot whose chunk format it matches — the main-thread chunk into `lepusCode`, other JS chunks into `manifest`, and CSS into `StyleInfo` — emitting JS as raw source (the web runtime wraps it at load). The default `target: 'tasm'` (the native bundle via `@lynx-js/tasm`) is unchanged.
