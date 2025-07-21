---
"@lynx-js/tailwind-preset": patch
---

Add scoped timing utilities for grouped transition properties to work around Lynx's lack of automatic transition value expansion.

- Added `duration-colors-*`, `delay-colors-*`, `ease-colors-*`, `duration-visual-*`, `ease-effects-*`, etc., matching the corresponding `transition-*` property groups.
