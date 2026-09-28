---
"@lynx-js/react": patch
"@lynx-js/react-umd": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Deliver the main-thread runtime through the normal module graph, including background-only injected definitions. Compiler requirements follow the final chunk graph and are refreshed during watch rebuilds, so runtime code participates in business defines, source maps, and release processing.

Combined lazy chunks share their paired main runtime, standalone lazy bundles bootstrap themselves, and older compiler output retains the legacy runtime chunk fallback.

The worklet init entry follows `worklet.runtimePkg`: remove a trailing `/internal`, if present, and append `/worklet-runtime/init`. Default worklet options use `@lynx-js/react/internal` for helpers.
