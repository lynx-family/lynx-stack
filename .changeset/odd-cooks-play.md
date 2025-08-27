---
"@lynx-js/web-mainthread-apis": minor
"@lynx-js/web-worker-runtime": minor
"@lynx-js/web-core-server": minor
"@lynx-js/web-worker-rpc": minor
"@lynx-js/web-constants": minor
"@lynx-js/web-core": minor
---

refactor: provide the mts a real globalThis

Before this change, We create a function wrapper and a fake globalThis for Javascript code.

This caused some issues.

After this change, we will create an iframe for createing an isolated Javascript context.

This means the globalThis will be the real one.
