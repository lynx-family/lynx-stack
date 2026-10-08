---
"@lynx-js/css-extract-webpack-plugin": patch
---

Fix `Conflict: Multiple assets emit different content to the same filename` on a CSS hot-update file shared by several lazy bundles in development, caused by the per-template `debugMetadataUrl` leaking into it.
