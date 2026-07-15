---
"@lynx-js/lynx-bundle-rslib-config": patch
---

Support enabling preact devtools for external bundles via the `REACT_DEVTOOL` environment variable.

When `REACT_DEVTOOL` is set, `defineExternalBundleRslibConfig` now keeps function and class names during minification (`keep_fnames`/`keep_classnames` on both `compress` and `mangle`), which devtools needs to resolve component names (`type.name`) and to reconstruct the hook tree (it matches minified stack frames by function name). The default output is unchanged when `REACT_DEVTOOL` is unset. This mirrors `pluginMinify` in `@lynx-js/rspeedy` (#2880).
