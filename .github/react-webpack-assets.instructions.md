---
applyTo: "packages/webpack/react-webpack-plugin/**/*"
---

When mutating emitted assets while iterating `compilation.chunkGroups`, deduplicate by asset filename. A shared async chunk can belong to multiple chunk groups, so chunk-group iteration may otherwise update the same physical asset more than once.

React webpack plugin tests load the plugin through its built `lib` package export. After changing `src`, rebuild through Turbo before interpreting test results.
When selecting per-bundle React worklet capabilities, inspect only modules in the encoded entry's chunk groups, recurse through concatenated modules, and query optimized export usage with each chunk's runtime. Use the dedicated `main-thread-object` public entry as the capability marker even when it is reached through root re-exports; implementation and shared registry modules are not evidence that an application opted in. Treat unknown marker export usage conservatively because standalone lazy bundles may adopt the capability after the main template is built.
