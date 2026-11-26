---
"@lynx-js/react-webpack-plugin": patch
---

Resolve `ReactWebpackPlugin.loaders` when it is first read instead of when the package is imported, so the package can be imported in the browser through `@rspack/browser`. The ReactLynx loaders now import the default `@lynx-js/react/transform` statically, so a bundler that packs them includes it; a custom `transformPath` is still loaded with `require`.
