---
"@lynx-js/chunk-loading-webpack-plugin": patch
---

Override `__webpack_require__.e` so a single sync-then chunk load (the
typical lazy bundle case) bypasses `Promise.all`. It will make first screen
in main thread can load lazy bundle synchronously when using dynamic import.
