---
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Refactor: Replace built-in `background-only` implementation with npm package

Previously we maintained custom files:

- `empty.ts` for background thread
- `error.ts` for main thread validation

Now adopting the standard `background-only` npm package
