---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Apply `pluginLynxDebugMetadata` once when it is registered more than once, for example next to `pluginLynx`, which already applies it.
