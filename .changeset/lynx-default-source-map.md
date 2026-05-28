---
"@lynx-js/rspeedy": minor
---

Default `output.sourceMap.js` to `source-map` for `lynx` environments in production when the project leaves it unset. The production default was previously `false` (no JS source map), which left the emitted `debug-metadata.json` without source maps and made reverse-resolution of production errors impossible without manual config. Non-`lynx` environments (e.g. `web`) are unchanged, and any explicit `output.sourceMap` is respected.
