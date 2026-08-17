---
applyTo: "packages/web-platform/{web-core/ts/client/mainthread/elementAPIs/WASMJSBinding.ts,web-core/tests/**,web-core-e2e/tests/**}"
---

When bridging mouse or pen Pointer Events into Lynx touch events, ignore touch pointers because browsers also emit DOM touch events for them, retain the pointer-down Lynx target through move/end/cancel, and leave `bindtap` on the DOM click path so one physical click cannot synthesize a second tap.
