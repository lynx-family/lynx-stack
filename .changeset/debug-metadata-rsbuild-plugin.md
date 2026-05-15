---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Extract `LynxDebugMetadataPlugin` and the `UI_SOURCE_MAP_RECORDS_BUILD_INFO` wire-protocol constant from `@lynx-js/template-webpack-plugin` into a new package `@lynx-js/debug-metadata-rsbuild-plugin`. Rspeedy now auto-registers `pluginLynxDebugMetadata` as a default plugin so every Lynx template build emits `debug-metadata.json` with zero user configuration; non-Lynx Rspeedy projects (e.g. `examples/template-webpack`) are unaffected because the plugin no-ops when no `LynxTemplatePlugin` is exposed. `@lynx-js/react-webpack-plugin`'s main-thread loader now imports the wire-protocol constant from the new package directly.
