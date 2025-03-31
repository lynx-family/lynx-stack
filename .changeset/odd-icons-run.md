---
"@lynx-js/web-mainthread-apis": minor
"@lynx-js/web-worker-runtime": minor
"@lynx-js/web-constants": minor
"@lynx-js/web-core": minor
---

feat: rewrite the main thread Element PAPIs

In this commit we've rewritten the main thread apis.

The most highlighted change is that

- Before this commit we send events directly to bts
- After this change, we send events to mts then send them to bts with some data combined.
