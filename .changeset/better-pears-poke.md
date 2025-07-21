---
"@lynx-js/tailwind-preset": patch
---

Improve transform transition compatibility with Lynx versions that do not support animating CSS variables.

- Added Lynx specific solo transform utilities that avoid CSS variables: `solo-translate-x-*`, `solo-scale-*`, `solo-rotate-*` etc. These utilities are implemented without CSS variables using raw transform functions such as `translateX()`, `scale()` and `rotate()`. They are mutually exclusive and cannot be combined with normal transform utilities.

- Enabled arbitrary values for `transform-[...]`: e.g. `transform-[translateX(20px)_rotate(10deg)]`, following Tailwind v4 behavior.
