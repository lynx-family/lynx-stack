---
applyTo: "packages/web-platform/web-core/ts/client/{background/background-apis/createChunkLoading.ts,mainthread/LynxView.ts},packages/web-platform/web-core/ts/types/BTSChunk.ts,packages/web-platform/web-core/tests/chunk-loading.spec.ts"
---

Keep ordinary `console.*` calls in background bundles scoped to the current
Lynx view. Resolve the lexical `console` from
`tt.NativeModules.LynxConsoleModule`, then `tt.sharedConsole`, then the Worker
global console. Do not mutate `globalThis.console`; explicit
`globalThis.console` access intentionally bypasses the per-view injection. Keep
synchronous bundles and asynchronous chunks on the same initialization path.
