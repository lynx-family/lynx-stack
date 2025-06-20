---
"@lynx-js/web-mainthread-apis": patch
---

fix: `decodeCssInJs` will not throw error.

Before this pr, decoding css will be strictly executed according to cssInfo, and an error will be thrown if data that does not meet the requirements is encountered. Now it is changed to console.warn, which will not block rendering.
