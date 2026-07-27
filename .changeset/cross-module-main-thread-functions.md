---
"@lynx-js/react": patch
---

Fix cross-module `'main thread'` functions failing to hydrate.

A `'main thread'` function defined in a different module from the worklet that calls it is captured into the caller's closure (`this._c`) and resolved at hydration through `lynxWorkletImpl._workletMap[id]`. Its `registerWorkletInternal()` call lives in the _defining_ module, which reached the main-thread bundle only through the caller's named import — and that import is dropped by DCE once the surrounding background-only code (`useEffect`, `runOnMainThread`, ...) is shaken away. The defining module then never ran on the main thread, so `_workletMap[id]` was `undefined` and hydration threw `Cannot read properties of undefined (reading 'bind')`.

The worklet transform now re-adds a side-effect-only import for every module a worklet closure captures an identifier from, keeping the registration reachable on the main thread.
