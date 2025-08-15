---
"@lynx-js/runtime-wrapper-webpack-plugin": minor
---

**Breaking Changes**:

Add `backgroundChunks` option to `RuntimeWrapperWebpackPlugin`, which allows the plugin to inject `module.export = [bts exports]` into the background script.
