---
applyTo: "packages/rspeedy/plugin-react/test/runtime-version.test.ts"
---

When matching emitted standalone lazy-bundle registration, assert the host `ReactInternal.registerRuntimeVersion` property call and build-time version together, but allow intervening compiler output such as coverage annotations and constant-folded fallback expressions. A short literal-to-call distance can fail even when the generated registration is correct.
