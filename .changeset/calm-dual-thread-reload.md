---
"@lynx-js/react": patch
---

Drop stale cross-thread function calls and return values after `reloadTemplate`. This prevents delayed calls from looking up cleared Element Template function contexts or resolving a newer call with an old result. Calls queued by old main-thread ref cleanup retain the old reload version.
