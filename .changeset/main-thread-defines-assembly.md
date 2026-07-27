---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/testing-environment": patch
---

Add `pluginReactLynx({ enableMainThread: false })`, which stops compiling business code for the main thread and assembles its bundle from the snapshot, worklet and element template definitions collected while compiling the background.
