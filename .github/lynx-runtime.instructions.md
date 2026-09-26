---
applyTo: "{packages/lynx/lynx-runtime/**,examples/vanilla/**}"
---

Keep Element PAPI creation, mutation, and flushing in the main-thread application code. The Lynx runtime package owns lifecycle registration, managed event listeners, and local or cross-thread dispatch only.

Organize runtime source by execution responsibility: shared types and event-channel code belongs in `src/common`, main-thread lifecycle code belongs in `src/main-thread`, and background lifecycle code belongs in `src/background`.

During main-thread initialization, install an identity `globalThis.processData` fallback only when one is missing, and do not remove it during destroy. Keep the fallback marked for removal once Lynx clients no longer require it. Pass Engine lifecycle payloads directly to the configured render and update callbacks.

Consume the runtime-provided `lynx` global directly in thread initializers. Do not wrap it with availability checks or host getter helpers.

Use `lynx.getEngine()` only for engine lifecycle events. Pair main-thread `lynx.getJSContext()` with background-thread `lynx.getCoreContext()` for cross-thread events, and use the opposite contexts only for thread-local events.

Forward `__DestroyLifetime` from the main thread to the background thread and remove every managed listener with the original event name and handler reference.

Keep cross-thread payloads small and serializable. Never send functions or Element PAPI references between threads.
