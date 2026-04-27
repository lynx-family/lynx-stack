---
name: a2ui-catalog-extractor
description: Generate or maintain A2UI catalog JSON from TypeDoc reflections for TypeScript interfaces marked with @a2uiCatalog.
---

# A2UI Catalog Extractor

Use this skill when a task involves authoring, updating, debugging, or generating A2UI catalog JSON from TSX/TypeScript component interfaces.

## Workflow

1. Mark only the catalog-facing TypeScript interface with `@a2uiCatalog <ComponentName>`.
2. Use only standard TypeDoc-supported tags besides `@a2uiCatalog`: summaries, `@remarks`, `@defaultValue`, and `@deprecated`.
3. Keep catalog-facing shapes inline in the marked interface. The extractor consumes TypeDoc reflection data and does not parse source files itself.
4. Generate component catalog files with:

```bash
a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog
```

## Supported Type Shapes

- `string`, `number`, `boolean`
- string literal unions, emitted as JSON Schema `enum`
- mixed unions, emitted as `oneOf`
- arrays with `T[]`, `Array<T>`, or `ReadonlyArray<T>`
- inline object type literals
- `Record<string, T>`

Developers should not write JSON Schema in comments. If extraction fails because a reference is unsupported, inline the component's catalog contract in the marked interface.
