---
"@lynx-js/lynx-bundle-rslib-config": minor
"@lynx-js/externals-loading-webpack-plugin": minor
---

Support content-hashed background section names via `encodeOptions.hashSectionNames` and `__sectionMap` resolution in external bundle loading to avoid stale `LynxGroup`-scoped `loadScript` cache hits after in-place bundle updates.
