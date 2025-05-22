---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/offscreen-document": patch
"@lynx-js/web-core": patch
"@lynx-js/web-core-server": patch
---

perf: improve dom operation performance

- code clean for offscreen-document, cut down inheritance levels
- add `appendChild` method for OffscreenElement, improve performance for append one node
- bypass some JS getter for dumping SSR string
