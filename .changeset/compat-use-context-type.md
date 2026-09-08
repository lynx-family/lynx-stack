---
"@lynx-js/react": patch
---

Type the context argument of `use` with React's `Context`, matching the rest of the public surface. `@lynx-js/react` re-exports `createContext` from `react`, so declaring `use` against Preact's `Context` made a context created through the package fail to type-check.
