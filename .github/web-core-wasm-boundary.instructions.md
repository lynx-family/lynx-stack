---
applyTo: "packages/web-platform/web-core/{src,ts,tests}/**/*,packages/web-platform/web-core-e2e/tests/**/*"
---

Treat every potentially throwing Rust-to-JavaScript import made while a `MainThreadWasmContext` export is active as a WebAssembly exception boundary: declare it with `wasm-bindgen(catch)` and consume its `Result` so an exception cannot escape through the wasm frame and leave the context's borrow guard active. For event dispatch, RPC, worklet, and event-listener registration failures that need Lynx-level observability, enqueue error reporting until after the wasm frame returns. Add regression tests that invoke another wasm context method after simulated JavaScript failures, exercise the Rust fallback independently of the TypeScript catch, and verify listener registration can recover after a failed attempt.
