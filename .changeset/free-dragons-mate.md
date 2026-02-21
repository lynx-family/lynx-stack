---
"@lynx-js/react": patch
---

Improve profiling support in React runtime with lower overhead when profiling is disabled.
Enable Profiling recording first, then enter the target page so the trace includes full render/hydrate phases.

- Add trace events for `useEffect` / `useLayoutEffect` hook entry, callback, and cleanup phases.
- Add trace event for `useState` setter calls.
- Add `profileFlowId` support in debug profile utilities and attach flow IDs to related hook traces.
- Add hydrate/background snapshot profiling around patch operations with richer args (e.g. snapshot id/type, dynamic part index, value type, and source when available).
- Capture vnode source mapping in dev and use it in profiling args to improve trace attribution.
- Add/expand debug test coverage for profile utilities, hook profiling behavior, vnode source mapping, and hydrate profiling branches.
