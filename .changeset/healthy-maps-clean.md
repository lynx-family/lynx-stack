---
"@lynx-js/react": patch
---

Fix "TypeError: cannot read property '0' of undefined" in deferred list-item scenarios.

Deferred `componentAtIndex` causes nodes that quickly appear/disappear to be enqueued without `__elements`. Update `signMap` before `__FlushElementTre` to resolve the issue.
