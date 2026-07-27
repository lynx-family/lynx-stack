---
"@lynx-js/template-webpack-plugin": patch
---

Actually keep the background sidecar source map on the web target.

The previous attempt (#3250) detached `related.sourceMap` with `updateAsset`
before calling `deleteAsset`. That does not work on rspack: the info updater
does not clear `related`, so the delete cascade still fires and the `.map` still
disappears. Reading `info.related.sourceMap` back immediately after the call
returns the original value, and every `.map` still vanishes from the output.

Take a reference to the map asset before the delete and re-emit it afterwards
instead. That depends on nothing but `emitAsset`.

Verified against a real build (rspeedy 0.16.0 / rspack 2.1.2) with
`output.sourceMap.js: 'source-map'` on the web target: before, zero `.map`
assets were emitted; after, `main/background.<hash>.js.map` is present along
with the main-thread, async-chunk and CSS maps.

Fixes #2964, which #3250 did not.
