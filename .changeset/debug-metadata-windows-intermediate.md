---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Normalize the per-template `intermediate` dir to POSIX separators before building the `debug-metadata.json` asset name and `debugMetadataUrl`. On Windows the lazy-bundle `intermediate` path contains backslashes that `path.posix.format` leaves untouched, so the emitted asset name (e.g. `async\Foo/debug-metadata.json`) no longer matched the forward-slash URL the dev-server/browser requested, 404'ing source-map and bytecode lookups for lazy bundles.
