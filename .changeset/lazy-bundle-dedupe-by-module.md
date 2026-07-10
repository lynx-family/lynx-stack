---
"@lynx-js/template-webpack-plugin": patch
---

Deduplicate lazy bundles: the same file imported via different paths (relative or alias) now produces a single bundle, emitted inside the `async/` directory.
