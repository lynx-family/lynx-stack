---
'@lynx-js/web-core': minor
---

Add an optional `nativeModulesInitData` property on `lynx-view` to pass per-module structured-cloneable initial data via the 3rd context argument (`{ initData }`) to background native module factories without changing `nativeModulesMap`.
