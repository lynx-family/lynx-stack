---
'@lynx-js/template-webpack-plugin': patch
---

Keep the background chunk's sidecar source map when `WebEncodePlugin` inlines the
chunk into the encoded `.web.bundle`.

`compilation.deleteAsset` also deletes everything in `assetInfo.related`, and
`related.sourceMap` is where `SourceMapDevToolPlugin` records the sidecar `.map`.
Because the inlined `app-service.js` is deleted after encoding, its map was
deleted with it — so on the web target `output.sourceMap.js: 'source-map'` and
`'hidden-source-map'` emitted no map for background-thread code at all, and only
`'inline-source-map'` produced one, by embedding it in the shipped bundle at
roughly 10x the size.

The related link is now detached before the delete, so the JS is still removed
(it lives inside the template) while its map survives as an ordinary asset —
matching what rsbuild does for the same configuration.

Fixes #2964.
