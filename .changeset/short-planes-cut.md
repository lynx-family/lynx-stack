---
"@lynx-js/web-core": patch
---

fix: preserve CSS variable fallback values when encoding web-core stylesheets so declarations like `var(--token, rgba(...))` are emitted with their fallback intact.
