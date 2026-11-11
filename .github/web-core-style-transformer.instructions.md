---
applyTo: "packages/web-platform/web-core/src/style_transformer/**"
---

Use `RENAME_RULE` in `rules.rs` for CSS property renames that preserve the value. This shared transformation path handles both stylesheet declarations and inline styles; keep value transformations in the existing token transformer.
