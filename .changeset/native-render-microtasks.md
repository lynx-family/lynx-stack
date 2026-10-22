---
'@lynx-js/react': patch
---

Schedule state updates through `lynx.queueMicrotask` in both Snapshot and Element Template runtimes, preserving the native API's receiver and falling back to Promise microtasks when it is unavailable.
