---
"@lynx-js/lynx-bundle-rslib-config": patch
"@lynx-js/react-webpack-plugin": patch
---

Register paired main-thread and background entries for external bundles so background-only snapshot and worklet definitions are included in the main-thread output. Collect eager imports in their owning definition scope instead of treating them as separate lazy chunks.
