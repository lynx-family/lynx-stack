---
"@lynx-js/chunk-loading-webpack-plugin": patch
---

Override `__webpack_require__.e` so a single sync-then chunk load (the
typical lazy bundle case) bypasses `Promise.all`. This preserves the
sync-then chain end-to-end so preact's `lazy(loader)` can resolve at
first render instead of always falling back to the Suspense fallback.
Multi-promise loads still take the `Promise.all` path unchanged.
