---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Inline the main-thread MTF runtime into the owning assets instead of injecting a prebuilt standalone runtime chunk.

This keeps the runtime on the normal JS asset pipeline so business defines, macros, sourcemaps, and Slardar processing apply consistently to both main bundles and lazy bundles.

The legacy `loadWorkletRuntime()` fallback path is still preserved for older bundles, while new lazy bundles now bootstrap their own main-thread runtime.
