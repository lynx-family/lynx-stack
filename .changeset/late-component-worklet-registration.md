---
'@lynx-js/externals-loading-webpack-plugin': patch
---

Evaluate synchronous and asynchronous external sections when their modules are imported instead of during runtime startup. This lets a page initialize its worklet runtime before importing legacy component externals, while preserving bundle prefetching and caching exports or the loading Promise on first access.
