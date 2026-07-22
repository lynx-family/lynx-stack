---
"@lynx-js/template-webpack-plugin": patch
---

Skip assetless async chunk groups when generating lazy bundles and their runtime URL mappings. This prevents Module Federation remote imports from being encoded as nonexistent Lynx lazy bundles.
