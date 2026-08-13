---
applyTo: "packages/{react/transform,webpack/react-webpack-plugin}/**/*"
---

Keep `MainThreadObject` lifecycle registration connected to the exact type token through a compiler marker emitted in both BTS and MTS output. Do not rely on the type module or hook body executing on MTS, because dual-thread rendering may prune or skip either path.
Preserve tree shaking at type granularity: a type used by either thread must retain its `create` and optional `dispose` definitions, while an unused sibling type and its lifecycle code must be removable.
When a lifecycle Main Thread Function imports `runtime: 'shared'` bindings, retain only the shared import specifiers that function references and resolve the generated lifecycle module relative to its owning source resource.
Cover BTS-only use, MTS-only use, unused sibling types, and `dispose` in production-mode bundle tests.
