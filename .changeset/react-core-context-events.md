---
"@lynx-js/react": patch
---

Subscribe to `__OnLifecycleEvent` and `__NotifyGlobalPropsUpdated` on `lynx.getCoreContext()` instead of overriding `tt.OnLifecycleEvent` / `tt.updateGlobalProps`. The engine already dispatches both as CoreContext message events, so the `tt` hop was pure indirection. Listener registration is now idempotent, as is `addCtxNotFoundEventListener`, which previously reported the same error twice when the runtime was initialized more than once.
