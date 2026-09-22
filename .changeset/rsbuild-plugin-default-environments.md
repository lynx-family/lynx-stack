---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/create-lynx": patch
---

Default `environments` to `{ lynx: {} }` when none is configured, aligned with Rspeedy. The Rsbuild templates no longer set it.
