---
"@lynx-js/lynx-bundle-rslib-config": minor
"@lynx-js/rsbuild-plugin": patch
---

The minify options come from `pluginLynx` now; `output.minify` only decides whether to minify at all. `pluginLynx` applies them per environment, so `output.minify: true` on an environment no longer drops them (part of #3723).
