---
"@lynx-js/react": patch
---

Run a GC pass after `reloadTemplate`, and after an update that arrives before
the first screen is synced, when the engine exposes `lepusng_gc`. Both replace
the rendered tree, and under reference counting the replaced tree is not freed
on its own.
