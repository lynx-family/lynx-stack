---
"@lynx-js/lynx-bundle-rslib-config": patch
"@lynx-js/rsbuild-plugin": patch
---

Build an external bundle without a DSL plugin using `pluginLynx` alone. It now registers the runtime wrapper and the encoder a bundle needs to be loadable, and `defineExternalBundleRslibConfig` falls back to its own exported `LAYERS` when no DSL exposes them.
