---
"@lynx-js/css-serializer": patch
---

feat: add support for @media, @supports, and @layer at-rules

Add support for additional CSS at-rules in the CSS serializer:

- `@media` - for media queries
- `@supports` - for feature queries
- `@layer` - for cascade layers (both named and anonymous)

The parser now handles these at-rules with proper recursive parsing support for nested at-rules.
