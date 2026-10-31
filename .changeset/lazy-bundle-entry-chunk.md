---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/css-extract-webpack-plugin": patch
---

Fix lazy bundle builds when `splitChunks` merges a shared module into the entry chunk. The entry chunk is no longer treated as part of each lazy bundle, so its CSS hot-update file is emitted only once and its main-thread code is not wrapped in the dynamic component IIFE.
