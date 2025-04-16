---
"@lynx-js/template-webpack-plugin": minor
---

Fixed an issue in rspeedy where chunks weren't being properly shared between multiple entries during chunk splitting. This resulted in duplicate chunks being generated, increasing bundle size and reducing performance.

**BREAKING CHANGE**: `encodeData.manifest` now only contains the `/app-service.js` entry.
