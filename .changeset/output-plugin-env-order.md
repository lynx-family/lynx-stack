---
"@lynx-js/rsbuild-plugin": patch
---

Fix the CSS output defaults overwriting the values another plugin had already set. `output.distPath.css`, `output.filename.css` and `output.legalComments` were merged per environment at the default hook order, so under the Rspeedy CLI, where `pluginLynx` is applied after user plugins, a plugin's value was silently discarded.
