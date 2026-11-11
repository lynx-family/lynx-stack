---
applyTo: "packages/webpack/react-webpack-plugin/**/*"
---

When mutating emitted assets while iterating `compilation.chunkGroups`, deduplicate by asset filename. A shared async chunk can belong to multiple chunk groups, so chunk-group iteration may otherwise update the same physical asset more than once.

React webpack plugin tests load the plugin through its built `lib` package export. After changing `src`, rebuild through Turbo before interpreting test results.
When rendering collected definition imports, quote all non-namespace export names with `JSON.stringify(imported)`. Quoted import names support ordinary identifiers and string-named exports without an identifier-validation regex.
