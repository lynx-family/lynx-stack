---
"@lynx-js/islands": patch
"@lynx-js/rsbuild-plugin": patch
---

Encode independent island resources through pluginLynx and the standard template
pipeline. Register pluginLynx alongside pluginIslands in resource producers.
Both inline and remote exposes now use the same beforeEncode section injection,
with configuration hooks, debug artifacts and emission handled by the shared engine.
