---
"@lynx-js/react-runtime": minor
"@lynx-js/react-transform": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/chunk-loading-webpack-plugin": minor
"@lynx-js/webpack-runtime-globals": minor
---

feat(react): load Element Template lazy bundles via `lynx.fetchBundle` (FetchBundle)

Element Template lazy bundles now load via `lynx.fetchBundle` + named `lynx.loadScript` sections instead of `lynx.QueryComponent`. The Snapshot path is unchanged.

Per-import sync/async loading is controlled by a native import attribute:

```ts
lazy(() => import('./X', { with: { mode: 'sync' } })); // first-screen direct render
lazy(() => import('./X', { with: { mode: 'async' } })); // background-driven (default)
```

The `mode` attribute is read at build time from the module-graph dependency's import attributes (rspack >= 2.0.3) and stamped into a per-chunk `__webpack_require__.lynx_acm` map, which the chunk-loading runtime threads into `lynx.loadLazyBundle(url, mode)`. ET lazy bundles are packaged as `customSections` (`main-thread` + `background` + `CSS`) with the element template definitions compiled into the bundle's tasm.
