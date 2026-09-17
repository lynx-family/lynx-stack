---
"@lynx-js/rspeedy": minor
---

**BREAKING CHANGE**: Remove `entries` from `ExposedAPI`. Rspeedy never set it; `pluginQRCode` reads the entry points from the environments instead.
