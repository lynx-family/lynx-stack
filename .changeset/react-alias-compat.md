---
"@lynx-js/react-alias-rsbuild-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Alias `react` to `@lynx-js/react/compat` instead of `@lynx-js/react`, so React libraries that import `react` get `useInsertionEffect`, `use`, `startTransition` and `useTransition`. A user-defined `react$` alias still takes precedence. The `@lynx-js/react/compat$` alias is no longer gated on the `@lynx-js/react` version: every supported version ships the `compat` entry.
