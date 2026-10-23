---
applyTo: "packages/motion/**"
---

Lynx for Web wraps each MTS chunk with a mutable lexical `window` binding so dependencies do not accidentally access the iframe's browser window while compatibility shims can replace it. Gate direct lexical assignment to `SystemInfo.platform === "web"` and preserve the `globalThis.window` fallback for native Lynx. Keep the lexical assignment wrapped in try/catch: older Lynx for Web runtimes declare the chunk-local binding as a `const`, and the shim must degrade to skipping the window facade instead of crashing the MTS chunk.

The Lynx for Web MTS realm also exposes browser DOM constructors. Motion must replace the constructors it already shims, such as `Element` and `HTMLElement`, because Lynx main-thread elements are not browser DOM nodes.

Keep `lynx.queueMicrotask` bound to its receiver in both the full and mini polyfills. Consumers may capture the global scheduler and call it detached. Repair a global that is exactly the unbound native method, but preserve independent host schedulers and the Promise fallback. Cover receiver-sensitive calls in tests rather than asserting that the global equals the native method.
