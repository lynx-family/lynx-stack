---
"@lynx-js/tailwind-preset": patch
---

Fixed transform-related CSS variables previously defined on `:root`; they are now reset on `*` to prevent inheritance between parent and child elements.
