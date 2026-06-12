---
"@lynx-js/css-extract-webpack-plugin": minor
---

**BREAKING CHANGE**

Remove `CssExtractWebpackPlugin` / `CssExtractWebpackPluginOptions` along with the `mini-css-extract-plugin` dependency. Use `CssExtractRspackPlugin` instead.

The `cssPlugins` option is now optional, defaulting to `[CSS.Plugins.removeFunctionWhiteSpace()]`.
