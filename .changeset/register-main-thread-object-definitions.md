---
"@lynx-js/react": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Register each used `MainThreadObject` type in the main-thread bundle even when its React hook renders only on the background thread, while preserving type-level tree shaking.
