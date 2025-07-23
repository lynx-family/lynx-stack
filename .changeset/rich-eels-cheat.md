---
"@lynx-js/tailwind-preset": patch
---

Introduce scoped timing utilities with auto-derived repeat count for grouped transition properties, working around Lynx's lack of automatic value expansion.

- Scoped utilities like `duration-colors-*`, `ease-colors-*`, and `delay-colors-*` are generated when `transitionProperty.colors` contains multiple properties.

- Scoped utilities like `duration-n-*`, `ease-n-*`,`delay-n-*` are generated when the `transitionProperty.DEFAULT` group contains multiple properties.

- For single-property transitions (e.g., `transition-opacity`, `transition-transform`), you must use Tailwind's default `duration-*`, `ease-*`, and `delay-*` utilities, no scoped timing utilities will be generated in these cases.
