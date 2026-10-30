---
'@lynx-js/react-webpack-plugin': minor
'@lynx-js/react-rsbuild-plugin': patch
---

Add the `LynxTemplatePlugin` option to `ReactWebpackPlugin` so React compilation and Native HMR hooks use the template plugin supplied by the build engine. `pluginReactLynx` passes the implementation exposed by `pluginLynx`; direct Rspack integrations keep using the one exported by `@lynx-js/template-webpack-plugin` by default.
