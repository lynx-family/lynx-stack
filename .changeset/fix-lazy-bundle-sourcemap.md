---
"@lynx-js/react-webpack-plugin": patch
---

Fix sourcemap misalignment for lazy bundles when `experimental_isLazyBundle: true` and `minify: true`.

The dynamic component IIFE wrapper is now injected via `BannerPlugin` at `PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1` (Stage 401), which allows Rspack to automatically shift VLQ sourcemap mappings by the correct number of lines. Previously the wrapper was applied via `ConcatSource` in `beforeEncode` (Stage 2500), after sourcemap finalization, resulting in an empty or misaligned `.js.map`.
