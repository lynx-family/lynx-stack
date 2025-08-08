---
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
"@lynx-js/web-worker-runtime": patch
---

feat: support path() for `createQuerySelector`

- Added `getPathInfo` API to `NativeApp` and its cross-thread handler for retrieving the path from a DOM node to the root.
- Implemented endpoint and handler registration in both background and UI threads.
- Implemented `nativeApp.getPathInfo()`
