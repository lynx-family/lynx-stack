---
"@lynx-js/runtime-config-webpack-plugin": patch
---

Reset the page-scoped runtime configuration to the current host bundle's configuration on every entry evaluation. Replace the previous object without freezing the new one, preventing read-only property errors and stale configuration after reload.
