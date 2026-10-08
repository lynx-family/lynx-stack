---
"@lynx-js/react-rsbuild-plugin": patch
---

Keep the main-thread chunks of lazy bundles out of `splitChunks`. They no longer carry `__main-thread` in their name since `webpackChunkName` stopped being injected, so they are now detected by their runtime.
