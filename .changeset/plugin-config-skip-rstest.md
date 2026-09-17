---
"@lynx-js/config-rsbuild-plugin": patch
---

Skip `LynxConfigWebpackPlugin` when the caller is Rstest, so `withLynxConfig()` no longer fails with "No `LynxTemplatePlugin` exposed" in a config that uses `pluginLynxConfig`. The Lynx config is still exposed to the other plugins.
