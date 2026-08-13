---
applyTo: "packages/motion/**"
---

Lynx for Web wraps each MTS chunk with a mutable lexical `window` binding so dependencies do not accidentally access the iframe's browser window while compatibility shims can replace it. Gate direct lexical assignment to `SystemInfo.platform === "web"` and preserve the `globalThis.window` fallback for native Lynx. Keep the lexical assignment wrapped in try/catch: older Lynx for Web runtimes declare the chunk-local binding as a `const`, and the shim must degrade to skipping the window facade instead of crashing the MTS chunk.

The Lynx for Web MTS realm also exposes browser DOM constructors. Motion must replace the constructors it already shims, such as `Element` and `HTMLElement`, because Lynx main-thread elements are not browser DOM nodes.

Keep `useMotionValue` typed as Motion's real `MotionValue`, but realize it through a module-scoped `MainThreadObjectType` and represent it as an opaque handle on the background thread. Declare its `create` and `dispose` lifecycle as capture-free Main Thread Functions, and import the Motion implementation through the shared runtime so its code is retained only in MTS. Type registration happens during MTS module evaluation and is idempotently ensured on first MTS hook use; `useMainThreadObject` creates the stable handle without shipping the lifecycle implementation to BTS. Resolve the first-frame style through the object's type-scoped handle inspection instead of duplicating payload metadata or duck-typing ReactLynx handle fields.

Keep declarative Motion semantics in `packages/motion`: render `initial` as ordinary Lynx style for the first frame, use `main-thread:ref` plus `runOnMainThread` for prop-driven animation updates, and bind MotionValue styles with the MTS `styleEffect`. Do not add Motion-specific lifecycle or prop handling to ReactLynx.
