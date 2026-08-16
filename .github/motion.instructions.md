---
applyTo: "packages/motion/**"
---

Lynx for Web wraps each MTS chunk with a mutable lexical `window` binding so dependencies do not accidentally access the iframe's browser window while compatibility shims can replace it. Gate direct lexical assignment to `SystemInfo.platform === "web"` and preserve the `globalThis.window` fallback for native Lynx. Keep the lexical assignment wrapped in try/catch: older Lynx for Web runtimes declare the chunk-local binding as a `const`, and the shim must degrade to skipping the window facade instead of crashing the MTS chunk.

The Lynx for Web MTS realm also exposes browser DOM constructors. Motion must replace the constructors it already shims, such as `Element` and `HTMLElement`, because Lynx main-thread elements are not browser DOM nodes.

Declare consumer-authored main-thread callback positions through `MotionMainThreadProps` brands and generate `directive-inference.json` from the emitted declarations. Do not add Motion names to the SWC transform or reintroduce directives in upstream-style consumer examples.
