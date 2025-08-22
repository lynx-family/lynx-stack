---
"@lynx-js/cache-events-webpack-plugin": patch
---

Add new `LynxCacheEventsPlugin`, which will cache Lynx native events until the BTS chunk is fully loaded, and replay them when the BTS chunk is ready.
