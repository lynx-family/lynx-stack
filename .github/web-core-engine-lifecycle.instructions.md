---
applyTo: "packages/web-platform/web-core/{ts/common/LynxEngineContext.ts,ts/client/mainthread/{createMainThreadGlobalAPIs.ts,LynxViewInstance.ts},ts/client/background/background-apis/**,ts/server/createServerLynx.ts,ts/types/{LynxContextEventTarget.ts,MainThreadLynx.ts,NativeApp.ts},tests/engine-context.spec.ts}"
---

Expose one stable, realm-local engine event target from `lynx.getEngine()` for
each Lynx page. Keep main-thread and background engine targets separate; engine
lifecycle events are local runtime events and must not be routed through the
cross-thread core or JavaScript contexts.

Dispatch `__DestroyLifetime` exactly once in each realm before releasing that
realm's event listeners, background card/worker state, or main-thread WASM
resources. Keep the SSR `lynx.getEngine()` surface available and stable so
scripts that register lifecycle cleanup remain server-compatible.
