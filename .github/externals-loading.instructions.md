---
applyTo: "packages/webpack/externals-loading-webpack-plugin/**"
---

Runtime loaders are normal modules exporting a synchronous factory and a Promise-returning load method. Bundle their imports through the module graph; never stringify URL resolvers or load callbacks. Share factory instances by runtime module and Lynx host object, preserving container and layer isolation. Runtime modules may use configured URLs or resolve their own, and must not import runtime-managed externals. Keep fixed-URL loading and the existing standalone async predicate compatible. Validate module exports, pending initialization, dependency imports, and failures by executing emitted bundles with callback-only native handlers.
