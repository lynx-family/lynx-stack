---
"@lynx-js/react": patch
---

Fix the "main-thread.js exception: ReferenceError: `__webpack_require__` is not defined" error in HMR.

This error occurred when setting `output.iife: true`, which is the default value in `@lynx-js/rspeedy` v0.9.8.
