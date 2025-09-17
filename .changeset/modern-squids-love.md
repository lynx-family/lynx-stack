---
"@lynx-js/tailwind-preset": patch
---

Fixed transform-related CSS variables previously defined on `:root`; they are now reset on `*` to prevent inheritance between parent and child elements.

Raised peer `tailwindcss` to `^3.4.12` to align with upstream change that ensures defaults are injected at the beginning of the base layer.
