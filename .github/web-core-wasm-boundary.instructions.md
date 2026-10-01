---
applyTo: "packages/web-platform/web-core/{src,ts,tests}/**/*,packages/web-platform/web-core-e2e/tests/**/*"
---

Treat potentially throwing Rust-to-JavaScript event dispatch imports made while a `MainThreadWasmContext` export is active as WebAssembly exception boundaries: declare them with `wasm-bindgen(catch)` and consume their `Result` so an exception cannot escape through the wasm frame and leave the context's borrow guard active. Keep this boundary independent of element event-listener registration and callback invocation. Add regression tests that throw from the real JavaScript binding and invoke another wasm context method afterward.
Do not silently discard cross-thread event or main-thread worklet failures at that boundary. Catch them in the JavaScript binding, defer reporting until the active WebAssembly frame has unwound, then route them through the main-thread `_ReportError` hook so hosts receive the existing `error` event.
