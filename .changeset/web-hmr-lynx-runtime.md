---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Fix the `web` environment crashing in development because its main thread was bundled with the Rsbuild web HMR runtime.

Previously the `web` environment was compiled with `target: 'web'`, which makes Rsbuild inject its own HMR client (`@rsbuild/core/dist/client/hmr.js`). That client drives `__webpack_require__.hmrM`, which is implemented with `lynx.requireModuleAsync` — an API the web main thread does not provide — so hot updates crashed.

The `web` environment now uses the same target and HMR entry as the `lynx` environment, going through Lynx's own HMR runtime instead of the Rsbuild web one.
