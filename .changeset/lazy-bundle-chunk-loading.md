---
"@lynx-js/chunk-loading-webpack-plugin": patch
---

Thread the requesting host and the import `mode` through the lazy-bundle runtime
so it can route the eval result and honor sync/async loading.
