---
"@lynx-js/react": patch
---

Support using `"jsx": "react-jsx"` along with `"jsxImportSource": "@lynx-js/react"` in `tsconfig.json`.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@lynx-js/react"
  }
}
```

This configuration enhances TypeScript definitions for standard JSX elements,
providing type errors for unsupported elements like `<div>` or `<button>`.
