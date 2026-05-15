---
"@lynx-js/debug-metadata-rsbuild-plugin": minor
"@lynx-js/debug-metadata": minor
"@lynx-js/rspeedy": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/react-webpack-plugin": minor
---

Add unified `debug-metadata.json` per Lynx entry.

- New `@lynx-js/debug-metadata` schema package (zero-dep).
- New `@lynx-js/debug-metadata-rsbuild-plugin` emits the file and serves `?field=…` queries in dev.
- JS `//# sourceMappingURL=` and tasm `templateDebugUrl` repointed at the new endpoint.
- `debug-info.json` no longer written to disk.
- Auto-registered by Rspeedy — zero user config.
