---
"@lynx-js/template-webpack-plugin": patch
---

Fixed an issue in rspeedy where chunks weren't being properly shared between multiple entries during chunk splitting. This resulted in duplicate chunks being generated, increasing bundle size and reducing performance.

**BREAKING CHANGE**: Exclude non-background files from the `encodeData.manifest`.
