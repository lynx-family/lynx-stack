---
"@lynx-js/react": patch
---

Retain main-thread worklet context references before offscreen snapshot elements are materialized, so event, ref, gesture, and spread callbacks stay alive until the DOM update path can attach them.
