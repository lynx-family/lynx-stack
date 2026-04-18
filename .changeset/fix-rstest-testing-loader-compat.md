---
'@lynx-js/react-webpack-plugin': patch
---

fix(rstest): normalize partial `compat` options in the testing loader

The testing loader forwards `compat` directly to `transformReactLynxSync` without normalization. When `compat` is supplied as a partial object, the required `target` field is absent and the WASM transform throws `Error: Missing field 'target'`. Added the same normalization already present in `getCommonOptions` for the background/main-thread loaders: fills in `target: 'MIXED'` and all other required fields with sensible defaults.
