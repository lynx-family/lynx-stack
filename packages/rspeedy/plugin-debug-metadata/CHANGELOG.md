# @lynx-js/debug-metadata-rsbuild-plugin

## 0.1.0

### Minor Changes

- Add unified `debug-metadata.json` per Lynx entry. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

  - New `@lynx-js/debug-metadata` schema package (zero-dep).
  - New `@lynx-js/debug-metadata-rsbuild-plugin` emits the file and serves `?field=…` queries in dev.
  - JS `//# sourceMappingURL=` and tasm `templateDebugUrl` repointed at the new endpoint.
  - `debug-info.json` no longer written to disk.
  - Auto-registered by Rspeedy — zero user config.

- ([#2760](https://github.com/lynx-family/lynx-stack/pull/2760))

### Patch Changes

- ([#2752](https://github.com/lynx-family/lynx-stack/pull/2752))

- Updated dependencies [[`a839d59`](https://github.com/lynx-family/lynx-stack/commit/a839d59b7f477a86f2cd10215d0b754264e54425), [`d3201df`](https://github.com/lynx-family/lynx-stack/commit/d3201dfa57964bfe6c8c52a803aeeb0fca1f2d27), [`409594b`](https://github.com/lynx-family/lynx-stack/commit/409594b9c51bb0c13f01c7d3f16949b27ebfdced), [`353363e`](https://github.com/lynx-family/lynx-stack/commit/353363e52dca3b252b39b34a3a87ce840dd308f3)]:
  - @lynx-js/debug-metadata@0.1.0
