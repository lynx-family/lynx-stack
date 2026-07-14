---
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Require the new lazy bundle chunk contract from paired packages: `@lynx-js/react-webpack-plugin` now needs `@lynx-js/template-webpack-plugin` `^0.13.0`, and `@lynx-js/react-rsbuild-plugin` now needs `@lynx-js/react` `^0.123.0`; older versions group async chunks by the injected `webpackChunkName` and cannot pair with the new plugins.
