---
"@lynx-js/chunk-loading-webpack-plugin": patch
---

feat(lazy-bundle): thread the host and `mode` through the lazy-bundle runtime

Pass the requesting host and the import `mode` to the lazy-bundle loader so the
runtime can route the eval result and honor sync/async loading.
