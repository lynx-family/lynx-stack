---
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/rspeedy": patch
"@lynx-js/react": patch
---

Support enabling preact devtools in production via the `REACT_DEVTOOL` environment variable.

By default `@lynx-js/preact-devtools` is aliased away in production builds. Setting the `REACT_DEVTOOL` environment variable now:

1. keeps a user-imported `@lynx-js/preact-devtools` from being stripped;
2. defines `__REACT_DEVTOOL__`, which gates the dev-only runtime hooks devtools depends on (such as `injectLepusMethods`) so they also run in production;
3. keeps function/class names during minification (`keep_fnames`/`keep_classnames`), which devtools needs to resolve component names (`type.name`) and to reconstruct the hook tree (it matches minified stack frames by function name).

`@lynx-js/react/debug` remains development-only.
