---
"@lynx-js/react": patch
---

Bind the snapshot runtime via `import` in development instead of inline `require('@lynx-js/react/internal')`, so dev builds work with async (promise) externals. Dev snapshot creators now receive the runtime as a parameter (staying self-contained for cross-thread HMR `DEV_ONLY_AddSnapshot`); production creators keep the statically tree-shakeable module-scope reference.
