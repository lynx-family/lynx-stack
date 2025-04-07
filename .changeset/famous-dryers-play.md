---
"@lynx-js/template-webpack-plugin": patch
---

Fix source-maps (`.js.map` files) were not accessible in the `compiler.hooks.afterEmit` hook.
