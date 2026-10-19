---
applyTo: "packages/web-platform/web-core/src/style_transformer/**"
---

Use `RENAME_RULE` in `rules.rs` for CSS property renames that preserve the value. This shared transformation path handles both stylesheet declarations and inline styles; keep value transformations in the existing token transformer.

Single-property `__AddInlineStyle` calls can use numeric IDs, kebab-case names, or camelCase names. Normalize string names before rule lookup while preserving case-sensitive custom properties, and remove renamed client properties using their emitted names. Cover these paths in `element-apis.spec.ts` and SSR tests; bulk inline style checks alone do not cover them.
