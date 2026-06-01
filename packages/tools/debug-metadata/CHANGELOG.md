# @lynx-js/debug-metadata

## 0.1.0

### Minor Changes

- Add unified `debug-metadata.json` per Lynx entry. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

  - New `@lynx-js/debug-metadata` schema package (zero-dep).
  - New `@lynx-js/debug-metadata-rsbuild-plugin` emits the file and serves `?field=…` queries in dev.
  - JS `//# sourceMappingURL=` and tasm `templateDebugUrl` repointed at the new endpoint.
  - `debug-info.json` no longer written to disk.
  - Auto-registered by Rspeedy — zero user config.

- Add a `remap` CLI and a matching `remapUiTree` API that reverse-resolve a Lynx UI node tree. Each node carrying a `nodeIndex` and a `debugMetadataUrl` is annotated with its source location (`repo`, `source`, `line`, `column`) from the embedded `uiSourceMap`; all other fields, and nodes that cannot be resolved, pass through unchanged. ([#2744](https://github.com/lynx-family/lynx-stack/pull/2744))

### Patch Changes

- ([#2752](https://github.com/lynx-family/lynx-stack/pull/2752))
