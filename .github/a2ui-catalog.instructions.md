---
applyTo: "packages/genui/a2ui*/**"
---

When maintaining A2UI component catalogs, keep the catalog-facing contract in a TypeScript interface marked with `@a2uiCatalog <ComponentName>`. The extractor consumes TypeDoc reflection data and does not parse TS/TSX source itself, so inline the JSON-schema-facing property shape instead of relying on aliases or external interfaces.

Only `@a2uiCatalog` is a custom tag. Use standard TypeDoc-supported comments and tags for metadata: summaries for descriptions, `@remarks` for additional description, `@defaultValue` for schema defaults, and `@deprecated` for deprecated fields. Do not write JSON Schema in comments. Preserve existing enum order when regenerating catalog JSON, because catalog snapshots and LLM prompts can depend on deterministic option ordering.
