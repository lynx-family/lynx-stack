---
"@lynx-js/cache-events-webpack-plugin": patch
---

Fix a memory leak in the cache-events runtime where the `tt` / `globalThis` method mocks were never uninstalled after all chunks loaded.

The mock functions installed on `globalThis.loadDynamicComponent` and `tt[...]` were left in place after `loaded` became `true`. Because they stayed reachable from `globalThis` / `tt`, their closures pinned the whole cache machinery (`lynx_ce`, `setupList`, the captured `tt` / `GlobalEventEmitter` and the original bound functions) for the entire app lifetime.

The replay functions now restore the original methods (guarded so they only revert their own mocks), `onLoaded` clears `cleanupList`, and `setupList` is reset so the setup closures can be collected.
