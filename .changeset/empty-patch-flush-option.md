---
"@lynx-js/react": patch
---

Tell the main thread when a background commit produces no element mutations.

When a background render commits without any snapshot patch (or ElementTemplate update op) and without any pending `runOnMainThread` task, `__FlushElementTree` is now called with `emptyPatch: true`. Hosts that understand the flag can end the pipeline early instead of walking the whole update path; older hosts simply ignore the unknown option, so this is safe on every engine version.
