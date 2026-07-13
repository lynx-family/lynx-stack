---
"@lynx-js/react-rsbuild-plugin": patch
---

Fail fast when `pluginReactLynx()` runs on a plain Rsbuild build without `pluginLynxPreset()`.

Building a Lynx app with the Rsbuild CLI directly requires `pluginLynxPreset()` (from `@lynx-js/preset-rsbuild-plugin`) to install the Lynx build engine. Without it, `pluginReactLynx()` used to silently produce a broken bundle. It now throws an actionable error pointing at the missing `pluginLynxPreset()`. The Rspeedy CLI and rslib/rstest paths are unaffected.
