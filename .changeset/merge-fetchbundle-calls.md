---
"@lynx-js/externals-loading-webpack-plugin": patch
---

perf: optimize external bundle loading by merging multiple `fetchBundle` calls for the same URL into a single request.
