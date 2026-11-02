---
"@lynx-js/web-core": patch
"@lynx-js/externals-loading-webpack-plugin": patch
---

Load main-thread external scripts asynchronously on web. Prefer the callback-based `lynx.loadScriptAsync` API when available, falling back to `lynx.loadScript` on older runtimes, and wait for script evaluation before applying external styles.
