---
"@lynx-js/preset-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

De-duplicate the Lynx build-plugin composition. The 11-plugin set (chunk loading, dev/HMR, swc, target, minify, output, …) was listed twice — once in `pluginLynxPreset` and once in the Rspeedy CLI's `applyDefaultPlugins` — and exposed as 11 individual exports on `@lynx-js/preset-rsbuild-plugin/internal` that the CLI had to keep in sync by hand.

It is now a single `composeLynxBuildPlugins(resolved)` function that both call, so the set/order/args are one source of truth. No behavior change: the composed plugin list is identical, and the example build is byte-identical (verified modulo the pre-existing async-chunk content hash).
