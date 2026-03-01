---
applyTo: "packages/web-platform/**/background-apis/**"
---
When wiring dispose handlers that call `@lynx-js/lynx-core/web` teardown APIs, guard `callDestroyLifetimeFun` behind a runtime capability check on `nativeGlobal.multiApps[id].callDestroyLifetimeFun` before invoking it. Some card/app variants in `multiApps` do not implement this lifecycle method, and unconditional calls can throw during dispose.
