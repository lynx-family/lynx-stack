---
"@lynx-js/react-rsbuild-plugin": patch
---

Disable `module.generator.json.JSONParse` option as it increases the bundle size of `main-thread.js`. For more detail, please see this [issue](https://github.com/webpack/webpack/issues/19319).
