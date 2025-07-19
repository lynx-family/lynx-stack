---
"@lynx-js/tailwind-preset": patch
---

Improve transform transition compatibility with Lynx versions that do not support animating CSS variables.

- Added solo transform utilities that avoid CSS variables: `solo-translate-x-*`, `solo-scale-*`, `solo-rotate-*` etc.

- Enabled arbitrary values for `transform-[...]`: e.g. `transform-[translateX(20px)_rotate(10deg)]`, following Tailwind v4 behavior.
