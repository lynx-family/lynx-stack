---
applyTo: "packages/lynx/autolink-codegen/**"
---

When generating a JavaScript `NativeModules` shim, never use Lynx's native
HostObject as the direct `Proxy` target. Use a plain JavaScript object as the
target and explicitly forward unrelated properties to the HostObject. QuickJS
enforces proxy invariants against the HostObject's native property descriptors
and may otherwise throw `proxy: inconsistent get`.

Keep `lynx.getModuleLoader()` as the standard Node-API loader fallback in
addition to compatibility loaders exposed on `globalThis`.
