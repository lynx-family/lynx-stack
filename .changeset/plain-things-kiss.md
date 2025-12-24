---
"@lynx-js/react": patch
---

Partially fix "main-thread.js exception: TypeError: cannot read property '__elements' of undefined" by recursively calling `snapshotDestroyList`.
