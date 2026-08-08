---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Register the snapshot and worklet definitions collected from the background build on the main thread, so a definition the main-thread bundle dropped no longer fails with `Snapshot not found`.
