---
"@lynx-js/react": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/css-extract-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Stop injecting `webpackChunkName` into dynamic imports so lazy bundle intermediate files stay inside the output directory.

The ReactLynx transform injected `webpackChunkName: "<request>-react__<layer>"`, so a dynamic import resolving above the compiler context (e.g. `import('../../Foo.js')`) leaked `../` into `[name]`/`[id]` and the intermediate js/css/hmr files escaped the output directory. Async chunks now keep rspack's own ids, `__webpack_require__.lynx_aci` maps them by chunk id, and each lazy bundle's intermediate JS and CSS are emitted under `.rspeedy/async/<bundle-name>/<layer>.js` and `<layer>.css` next to its other intermediate outputs (`tasm.json`, `debug-metadata.json`, CSS hot-update files). Explicit `webpackChunkName` comments written by users are still honored and keep the user-controlled `[name]` placement.

These packages release together and must be upgraded together: `@lynx-js/react-webpack-plugin` and `@lynx-js/css-extract-webpack-plugin` require `@lynx-js/template-webpack-plugin` `^0.13.0`, and `@lynx-js/react-rsbuild-plugin` requires `@lynx-js/react` `^0.123.0`.
