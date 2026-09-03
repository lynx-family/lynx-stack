---
"@lynx-js/rsbuild-plugin": patch
---

Honor `output.filename.css`, `output.distPath.css`, `output.legalComments`, `output.sourceMap.js` and `dev.assetPrefix` when they are set on an environment. `pluginLynx` used to read them from the root of the config only and silently replaced a per-environment value with its own default.
