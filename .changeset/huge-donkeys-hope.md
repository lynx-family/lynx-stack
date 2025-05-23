---
"@lynx-js/template-webpack-plugin": patch
---

Fix a bug that the `lepus` arg of `beforeEmit` hook does not contains the `root` main chunk of the main thread.
