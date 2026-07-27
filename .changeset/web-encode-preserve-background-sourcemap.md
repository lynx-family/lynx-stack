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

The map is now read before the delete and re-emitted after it, so the JS is
still removed (it lives inside the template) while its map survives as an
ordinary asset — matching what rsbuild does for the same configuration.

Detaching `related.sourceMap` with `updateAsset` first, which is what this
changeset originally described, does **not** work: on rspack the info updater
does not clear `related`, so the cascade still fires and the map still
disappears. Reading `info.related.sourceMap` back immediately after the call
returns the original value.

Covered by `test/cases/web/source-map`, a real rspack build asserting that
`a/a.js.map` is in the emitted set while `a/a.js` is not. Against the detach
implementation that case reports `a/a.js.map was deleted with the asset it
belongs to`.

Fixes #2964.
