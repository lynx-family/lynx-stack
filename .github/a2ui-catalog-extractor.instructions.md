---
applyTo: "packages/genui/{a2ui,a2ui-catalog-extractor}/**"
---

Treat `.tsx` as the primary authoring path for catalog extraction and use `.jsx` only as a best-effort compatibility path.
Prefer explicit local TypeScript syntax plus standard JSDoc, TSDoc, and TypeDoc tags over custom annotations.
Use `@a2uiSchema` only for node-local JSON Schema fragments that cannot be represented clearly with normal declarations.
Keep the `@a2uiSchema` flow TypeDoc-first with a TypeScript AST fallback for inline property declarations.
Preserve legacy A2UI shard compatibility for `dist/catalog/*/catalog.json` unless the task explicitly changes the output contract.
Use `$TURBO_ROOT$` for cross-package Turbo inputs instead of sibling relative paths.
When extraction behavior changes, update the golden fixtures in `packages/genui/a2ui-catalog-extractor/test/fixtures/legacy-baseline` and rerun the extractor tests plus the `@lynx-js/a2ui-reactlynx` build.
