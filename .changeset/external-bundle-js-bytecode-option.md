---
"@lynx-js/lynx-bundle-rslib-config": minor
---

Add an `enableJsBytecode` option to `EncodeOptions` (and `ExternalBundleWebpackPluginOptions`) that controls whether main thread chunks are compiled to JsBytecode in the emitted external bundle. It defaults to `false` when `NODE_ENV` is `'development'` — keeping main thread chunks as plain JavaScript source for faster encoding and easier debugging — and `true` otherwise. The option only affects the `'tasm'` target; for the `'web'` target the `JsBytecode` tag is routing-only and always kept.
