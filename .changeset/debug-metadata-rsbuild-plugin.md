---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
"@lynx-js/debug-metadata": patch
"@lynx-js/rspeedy": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Add unified `debug-metadata.json` per Lynx entry.

- New `@lynx-js/debug-metadata` schema package (zero-dep).
- New `@lynx-js/debug-metadata-rsbuild-plugin` emits the file and serves `?field=…` queries in dev.
- JS `//# sourceMappingURL=` and tasm `templateDebugUrl` repointed at the new endpoint.
- `debug-info.json` no longer written to disk.
- Auto-registered by Rspeedy — zero user config.
