---
"@lynx-js/web-mainthread-apis": patch
---

fix: `decodeCssInJs` function will no longer throw an error, this is to avoid affecting the execution of `cssId -1` when `enableCssSelector: false`
