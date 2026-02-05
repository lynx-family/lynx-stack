---
"@lynx-js/react": patch
---

fix: Main thread functions cannot access properties on `this` before hydration completes.

This fixes the `cannot convert to object` error.
