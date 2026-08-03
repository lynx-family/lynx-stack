---
"@lynx-js/testing-environment": patch
---

Model the engine's real `ContextProxy` routing: each thread now owns its own `getCoreContext()`/`getJSContext()` proxy pair, and an event whose target equals the dispatching proxy's origin is delivered locally instead of crossing threads (matching `context_proxy.cc`). Previously both contexts shared one event bus, so wrong-direction dispatches (e.g. `lynx.getCoreContext().dispatchEvent(...)` from the main thread) still reached the other thread in tests while silently failing on real devices.
