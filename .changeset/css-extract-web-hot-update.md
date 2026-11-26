---
"@lynx-js/css-extract-webpack-plugin": patch
---

Make the CSS hot update runtime work on web, where there is no `lynx.__chunk_entries__`. Before, it threw a `TypeError` there. It now updates the CSS of the template's own chunk and takes the entry from lynx-core's `globDynamicComponentEntry`. The CSS of async chunks is still only hot-updated on native Lynx.
