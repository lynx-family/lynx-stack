---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Aggregate semantic runtime requirements over final emitted chunk modules, excluding tree-shaken candidates and including concatenated and injected definitions. Expose versioned semantic React compilation results through `Symbol.for('@lynx-js/react/internal:compile-result')`. Consumers can read main-thread programmability requirements from Stats or MultiStats without inspecting filenames. Missing or incompatible compilation results remain unknown rather than becoming an explicit false result.

Export the shared `ReactCompileResult` type from both plugin packages and `ReactCompileResultExposureV1` from the Rsbuild plugin. Document how to consume original Stats objects and select a single environment in mixed builds.
