---
applyTo: "**/*.{ts,tsx,cts,mts,js,cjs,mjs,json,jsonc,yaml,yml}"
---

When migrating Lynx Stack to TypeScript 7, keep the root compiler on TS7 but isolate tools that still depend on the legacy TypeScript JavaScript API, such as TypeDoc or typescript-eslint, by giving those packages a private TypeScript 5 dependency through pnpm hooks instead of relaxing the workspace TypeScript peer globally.

Prefer `@ttsc/unplugin/turbopack` with a narrowly scoped include for typia validators that still use typia under TS7. If typia hangs on external generated declarations or emits incomplete helpers for recursive extension-point types, keep the public API types intact, make those fields opaque in the typia-only validation view, and add small explicit runtime validation for the affected fields.
