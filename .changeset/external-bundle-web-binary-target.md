---
"@lynx-js/lynx-bundle-rslib-config": minor
---

Add a `web` encode target to `defineExternalBundleRslibConfig` (`encodeOptions.target: 'web'`).

When set, the external bundle is emitted as a web binary bundle (`<name>.web.bundle`, encoded via `@lynx-js/web-core/encode`) that the Lynx web platform can decode and load with `lynx.fetchBundle` / `lynx.loadScript`. For the web target, sections are emitted as raw JS (the web runtime wraps them when they are loaded) and CSS is folded into the StyleInfo section. The default `target: 'tasm'` (the native bundle via `@lynx-js/tasm`) is unchanged.
