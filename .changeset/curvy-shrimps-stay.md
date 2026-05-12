---
"@lynx-js/web-core": patch
---

fix: conditionally pass Card and Component params based on cardType in background thread sandbox

When `cardType` is `"react"`, the `Card` and `Component` sandbox parameters are omitted from `createChunkLoading` since ReactLynx bundles do not declare these in their function signature. Passing them unconditionally caused a parameter position shift, resulting in `lynx` being `undefined` and a `loadCard failed TypeError: Cannot read properties of undefined (reading 'performance')` crash.
