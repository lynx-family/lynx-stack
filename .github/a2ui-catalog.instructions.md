---
applyTo: "packages/genui/a2ui*/**"
---

When maintaining A2UI component catalogs, keep the catalog-facing contract in a TypeScript interface marked with `@a2uiCatalog <ComponentName>`. The extractor consumes TypeDoc reflection data and does not parse TS/TSX source itself, so inline the JSON-schema-facing property shape instead of relying on aliases or external interfaces.

Only `@a2uiCatalog` is a custom tag. Use standard TypeDoc-supported comments and tags for metadata: summaries for descriptions, `@remarks` for additional description, `@defaultValue` for schema defaults, and `@deprecated` for deprecated fields. Do not write JSON Schema in comments. Preserve existing enum order when regenerating catalog JSON, because catalog snapshots and LLM prompts can depend on deterministic option ordering.

Keep built-in catalog CSS assets in `packages/genui/a2ui/styles/catalog/*.css`, not under `src/catalog`. Catalog component TSX files should import those assets through paths that stay valid after TypeScript emits `dist/catalog/<Component>/index.jsx`, for example `../../../styles/catalog/Button.css`.

If an A2UI package runs a workspace CLI during its `build` script, add an explicit package-level `turbo.json` dependency on that tool package's `#build` task. For the CLI tool package itself, declare its built artifacts such as `dist/**` in its own `turbo.json` outputs so Turbo cache hits restore the executable entrypoints instead of only replaying logs. Do not rely on the workspace package manager link alone to guarantee the CLI package's `dist` artifacts exist before the consumer build starts.
