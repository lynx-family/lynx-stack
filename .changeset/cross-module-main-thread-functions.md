---
"@lynx-js/react": patch
---

Keep cross-module `'main thread'` functions reachable on the main thread.

A `'main thread'` function defined in a different module from the code that references it could throw at hydration with `Cannot read properties of undefined (reading 'bind')`.

The worklet id is content-addressed and target-independent, so both layers derive the same `_wkltId` — but the two halves of that symbol live in different bundles: the `registerWorkletInternal()` definition only in the main-thread bundle, the `{ _wkltId }` reference in either. The defining module reached the main-thread bundle solely through the referencing module's named import, and once the main-thread passes shook away the background-only code around the reference (`useEffect` and friends), that import became locally unused and was elided, taking the registration with it.

The worklet transform now re-emits a side-effect-only import for every module a worklet closure captures an identifier from, so the defining module still reaches the main-thread bundle and registers its worklet. Import attributes (`with { type: 'json' }`) are carried over; type-only and `runtime: "shared"` imports are skipped; background output is unchanged.

This is a targeted fix, not a complete one. It does not cover references the transform cannot see — `runOnMainThread(importedMtFn)()`, captures through a local alias, or references reachable only from background-only code — and the emitted import can still be elided when the consuming package declares `"sideEffects": false`. There are no build-time diagnostics for those cases yet.
