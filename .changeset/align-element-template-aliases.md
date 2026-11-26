---
"@lynx-js/react": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Align Element Template runtime aliases and compiler-injected entry specifiers across `@lynx-js/react`, `@lynx-js/react-alias-rsbuild-plugin`, `@lynx-js/react-rsbuild-plugin`, and `@lynx-js/react-webpack-plugin`:

- Export `./element-template/experimental/lazy/import` from `@lynx-js/react` (with fallback to `runtime/lazy/element-template-import.js` on older peers).
- Alias `@lynx-js/react/lepus$` and `@lynx-js/react/element-template/jsx-(dev-)runtime$` consistently across layers and read `lazy`/`elementTemplate` options lazily during `modifyBundlerChain`.
- Route Element Template `compat`, `worklet`, `dynamicImport`, `Defines`, and testing-loader `jsxImportSource` to explicit Element Template runtime entries.
