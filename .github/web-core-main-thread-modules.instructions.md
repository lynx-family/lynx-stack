---
applyTo: "packages/web-platform/web-core/**"
---

Main-thread `lynx.module(name)` resolves modules directly from the current view's `mainThreadModules` property on every lookup. Keep these host objects scoped to the view and separate from the background thread's URL-based `nativeModulesMap`; do not clone or send them to the worker. Hosts own method restrictions and data synchronization. The server runtime has no host view and returns `undefined` for module lookups.
