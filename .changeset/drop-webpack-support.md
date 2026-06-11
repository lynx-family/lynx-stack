---
"@lynx-js/css-extract-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/react-refresh-webpack-plugin": minor
"@lynx-js/runtime-wrapper-webpack-plugin": minor
"@lynx-js/cache-events-webpack-plugin": minor
"@lynx-js/chunk-loading-webpack-plugin": minor
"@lynx-js/lynx-bundle-rslib-config": minor
---

**BREAKING CHANGE**

Drop webpack support — the plugins now target Rspack only. All public types come from `@rspack/core` instead of `webpack` (e.g. `Compiler`, `Compilation`, `LoaderContext`), and the `webpack` dependency is removed.
