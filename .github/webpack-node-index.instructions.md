---
applyTo: "packages/webpack/{react-webpack-plugin,template-webpack-plugin}/**/*"
---

When emitting React UI source map metadata during template generation, emit `debug-metadata.json` into the template plugin `intermediate` directory, not beside `template.js`. The file should keep the sourcemap payload under a top-level `uiSourceMap` field and place auxiliary data such as `templateDebug` and `git` under `meta`, instead of serializing raw `uiSourceMapRecords`.
Keep UI source map generation opt-in behind `pluginReactLynx({ enableUiSourceMap: true })`. When the flag is off, do not collect `uiSourceMapRecords`, do not emit `debug-metadata.json`, and do not inject `debugMetadataUrl` into encode data.
Collect `uiSourceMapRecords` from main-thread loader results by storing them on module `buildInfo`, then aggregate them per template entry group before emit. The emitted `uiSourceMap.sources` array should use project-root-relative POSIX paths, `uiSourceMap.mappings` should follow sourcemap-style source locations as `[sourceIndex, line, column]`, and `uiSourceMap.uiMaps` should be a parallel array where `uiMaps[i]` is the runtime `nodeIndex` for `mappings[i]`. Keep the emitted line and column values 0-based even if transform-time records are editor-friendly 1-based.
If a webpack plugin emits extra intermediate assets during `beforeEncode` such as `debug-metadata.json`, register their asset names on `args.intermediateAssets` so `LynxEncodePlugin` / `WebEncodePlugin` can clean them with the rest of the intermediate encode artifacts after template generation.
