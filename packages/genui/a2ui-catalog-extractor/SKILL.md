---
name: a2ui-catalog-extractor
description: Use when updating the A2UI catalog extractor, annotating catalog components with JSDoc or TSDoc, or validating legacy catalog shard parity.
---

# A2UI Catalog Extractor

Use this skill when you are:

- changing `packages/genui/a2ui-catalog-extractor`
- annotating `packages/genui/a2ui/src/catalog/*/index.tsx`
- debugging generated `dist/catalog/*/catalog.json` output

## Workflow

1. Keep `.tsx` as the primary authoring path.
2. Prefer explicit declaration syntax and standard tags over custom annotations.
3. Use `@a2uiSchema` only for node-local JSON Schema fragments that cannot be expressed safely with normal declarations.
4. Preserve legacy shard compatibility for A2UI unless the task explicitly changes the contract.

## Key Rules

- Component names come from exported symbols.
- Property descriptions come from normal doc comments.
- `@defaultValue` and `@default` map to JSON Schema `default`.
- String literal unions map to `enum`.
- Optional props are omitted from `required`.
- Ignore framework-only props such as `id`, `surface`, `setValue`, `sendAction`, `dataContextPath`, `__template`, and `component`.

## Important Implementation Note

TypeDoc is used for the standard documentation surface, but custom block tag payloads are read from the TypeScript AST. Do not move `@a2uiSchema` parsing back to TypeDoc unless TypeDoc starts preserving custom block tag bodies reliably.

## References

- Read [references/tsdoc-mapping.md](./references/tsdoc-mapping.md) when changing extraction rules.
- Read [references/a2ui-v0.9-schema.md](./references/a2ui-v0.9-schema.md) when changing the catalog surface or compatibility targets.

## Validation

Use the repository's Node 24 toolchain:

```bash
fnm exec --using v24.15.0 -- pnpm --filter @lynx-js/a2ui-catalog-extractor test
fnm exec --using v24.15.0 -- pnpm --filter @lynx-js/a2ui-reactlynx build
```
