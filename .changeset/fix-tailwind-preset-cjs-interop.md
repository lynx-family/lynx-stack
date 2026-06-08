---
"@lynx-js/tailwind-preset": minor
---

Fix ESM/CJS interop for tailwindcss internal imports.

The built output previously used named ESM imports from tailwindcss CJS modules whose exports cannot be detected by Node.js's `cjs-module-lexer` (due to the dynamic `_export()` helper pattern). This caused runtime errors like:

```text
SyntaxError: The requested module 'tailwindcss/lib/lib/setupContextUtils.js' does not provide an export named 'INTERNAL_FEATURES'
```

Uses `createRequire(import.meta.url)` to load tailwindcss CJS internals directly, bypassing ESM/CJS interop issues in both output formats.
