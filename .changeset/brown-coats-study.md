---
"@lynx-js/web-mainthread-apis": patch
---

feat(web): use pure DOM API to implement Element PAPIs

1. rewrite all element PAPIs impl. Now we use DOM.
2. use our new package `@lynx-js/offscreen-document` to support the new Element PAPI implementation in a worker
