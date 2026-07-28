---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/testing-environment": patch
---

Add `pluginReactLynx({ enableMTSRendering: false })`, which stops compiling business code for the main thread and assembles its bundle from the snapshot and worklet definitions collected while compiling the background.
