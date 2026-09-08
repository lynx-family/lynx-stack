---
"@lynx-js/rsbuild-plugin": patch
---

Fix the CSS source map default overwriting the value another plugin had already set. `output.sourceMap.css` was enabled per environment at the default hook order, so under the Rspeedy CLI, where `pluginLynx` is applied after user plugins, a plugin's value was silently discarded.
