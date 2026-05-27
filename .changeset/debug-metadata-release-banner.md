---
"@lynx-js/debug-metadata-rsbuild-plugin": minor
---

Inject a per-chunk source-map release banner (`release = chunk.hash`) into every JS chunk, registering it with the Lynx engine via `_SetSourceMapRelease`. Runtime errors then carry a release equal to the source-map `key` in `debug-metadata.json`, so reverse-resolution can locate the container by release without the slardar plugin. Per-chunk, so lazy bundles each report their own release.
