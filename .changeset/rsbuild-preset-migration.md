---
"@lynx-js/preset-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Extract the Lynx build engine (default plugins, config schema, and helpers) into the new `@lynx-js/preset-rsbuild-plugin` package, so a Lynx app can be built with the Rsbuild CLI directly via `pluginLynxPreset()` instead of the Rspeedy CLI. `@lynx-js/rspeedy` now composes the engine from the preset and re-exports its public config types, so its public API is unchanged.
