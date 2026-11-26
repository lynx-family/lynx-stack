---
"@lynx-js/react": patch
---

Resolve `@lynx-js/react/transform` to its wasm build under the `browser` condition. The default entry also requires the napi build, which is not published, so a bundler targeting the browser (for a build through `@rspack/browser`) could not resolve it.
