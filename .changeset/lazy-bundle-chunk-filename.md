---
"@lynx-js/template-webpack-plugin": patch
---

Fix the JavaScript chunk of a lazy bundle ignoring `output.filenameHash`. It is now named like the entry of its layer, so `background.[contenthash:8].js` is emitted next to `main-thread.js` in production, and the chunk of a non-Lynx environment stays in that environment's output root instead of `.lynx/`.
