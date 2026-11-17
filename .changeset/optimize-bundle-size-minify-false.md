---
'@lynx-js/react-rsbuild-plugin': patch
---

Respect `output.minify: false` when `optimizeBundleSize` is enabled. Previously the `pure_funcs` options were merged into `output.minify`, which turned `false` into an object and re-enabled JS minification.
