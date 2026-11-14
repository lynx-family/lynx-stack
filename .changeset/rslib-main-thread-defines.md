---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Collect paired main-thread and background entries in pluginReactLynx after entry transforms for both applications and external bundles, so background-only snapshot and worklet definitions are emitted in the corresponding main-thread scope. Preserve lazy boundaries and legacy worklet runtime requirements.
