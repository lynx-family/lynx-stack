---
"@lynx-js/react": patch
---

Parse `.ts`, `.mts` and `.cts` files as TypeScript instead of TSX in `@lynx-js/react/testing-library`, so that generic arrow functions like `const identity = <T>(value: T): T => value` no longer fail with `Expected ',', got ':'`.
