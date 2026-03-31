---
applyTo: "packages/webpack/{react-webpack-plugin,template-webpack-plugin}/**/*"
---

When emitting React node index metadata during template generation, keep the final asset aligned with the NodeIndex RFC: emit `node-index-map.json` into the template plugin `intermediate` directory, not beside `template.js`, and use the compact `{ version, sources, mappings, uiMaps }` shape instead of serializing raw `nodeIndexRecords`.
Keep node index generation opt-in behind `pluginReactLynx({ enableNodeIndex: true })`. When the flag is off, do not collect `nodeIndexRecords`, do not emit `node-index-map.json`, and do not inject `nodeIndexMapUrl` into encode data.
Collect `nodeIndexRecords` from main-thread loader results by storing them on module `buildInfo`, then aggregate them per template entry group before emit. The emitted `sources` array should use project-root-relative POSIX paths, `mappings` should follow sourcemap-style source locations as `[sourceIndex, line, column]`, and `uiMaps` should be a parallel array where `uiMaps[i]` is the `nodeIndex` for `mappings[i]`. Keep the emitted line and column values 0-based even if transform-time records are editor-friendly 1-based.
If a webpack plugin emits extra intermediate assets during `beforeEncode` such as `node-index-map.json`, register their asset names on `args.intermediateAssets` so `LynxEncodePlugin` / `WebEncodePlugin` can clean them with the rest of the intermediate encode artifacts after template generation.
