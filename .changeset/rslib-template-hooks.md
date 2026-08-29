---
"@lynx-js/rsbuild-plugin": minor
"@lynx-js/lynx-bundle-rslib-config": minor
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Drive the template lifecycle hooks when assembling an external bundle, so the plugins that tap them cover it too. `pluginLynxDebugMetadata` is the first: an external bundle now ships source maps and a release key.
