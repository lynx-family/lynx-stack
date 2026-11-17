---
"@lynx-js/react": patch
---

Detect repeated state updates from `useEffect` in development when `@lynx-js/react/debug` is imported. After more than 50 consecutive passive-effect batches each enqueue an update within the same render root, ReactLynx logs a `Maximum update depth exceeded` error with the triggering component stack while allowing updates to continue.
