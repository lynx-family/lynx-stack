# A2UI ReactLynx

`@lynx-js/a2ui-reactlynx` contains the ReactLynx-side runtime and catalog components for A2UI experiments in this repository.

## What Is Here

- `src/core`: rendering, actions, and data-binding helpers
- `src/catalog/*`: catalog component implementations
- `dist/catalog/*/catalog.json`: generated catalog shards used by the package build

## Catalog Generation

Catalog JSON is generated from the component source in `src/catalog/*/index.tsx`.

The build now uses `@lynx-js/a2ui-catalog-extractor`, which reads:

- explicit TypeScript declaration syntax
- standard JSDoc, TSDoc, and TypeDoc tags
- the minimal `@a2uiSchema` escape hatch for exact nested schema fragments

This keeps the catalog authoring flow close to the component code and avoids depending on fragile checker-driven type resolution for complex cases.

## Build

From the repository root:

```bash
fnm exec --using v24.15.0 -- pnpm --filter @lynx-js/a2ui-reactlynx build
```

That build regenerates `dist/catalog/*/catalog.json` before running `tsc -b`.
