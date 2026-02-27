---
"@lynx-js/react": patch
---

Improve React runtime hook profiling.
Enable Profiling recording first, then enter the target page so the trace includes full render/hydrate phases.

- Record trace events for `useEffect` / `useLayoutEffect` hook entry, callback, and cleanup phases.
- Log trace events for `useState` setter calls.
- Wire `profileFlowId` support in debug profile utilities and attach flow IDs to related hook traces.
- Instrument hydrate/background snapshot profiling around patch operations with richer args (e.g. snapshot id/type, dynamic part index, value type, and source when available).
- Capture vnode source mapping in dev and use it in profiling args to improve trace attribution.
- Expand debug test coverage for profile utilities, hook profiling behavior, vnode source mapping, and hydrate profiling branches.
