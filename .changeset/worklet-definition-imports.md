---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
---

Preserve imports such as `runOnBackground` when injecting background-only worklet definitions into the main thread. Keep imported bindings isolated between definitions and resolve relative imports from their original module.
