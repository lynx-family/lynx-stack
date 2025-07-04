---
"@lynx-js/tailwind-preset": minor
---

Add createLynxPreset, expand Lynx plugin coverage, and enforce strict config types

- Supports TypeScript config `tailwind.config.ts`.

- New `createLynxPreset()` Factory: enabling/disabling of Lynx plugins.

- Added v3 utilities: `align-*`, `basis-*`, `col-*`, `inset-*`, `justify-items-*`, `justify-self-*`, `row-*`, `shadow-*`, `size-*`, `indent-*`, `aspect-*`, `animation-*`.

- Added v4 utilities: `rotate-x-*`, `rotate-y-*`, `rotate-z-*`, `translate-z-*`, `perspective-*`.

- Added Lynx Specific utilities: `display-relative`, `linear`, `ltr`, `rtr`, `normal`, `lynx-ltr`.

- Refined Lynx Compatiable Utilities: `bg-clip-*`, `content-*`, `text-*`(textAlign), `justify-*`, `overflow-*`, `whitespace-*`, `break-*`.

- Removed Lynx Uncompatiable Utilties: `collapse`.

- Refined Lynx Compatiable Theme Object: `boxShadow`, `transitionProperty`, `zIndex`, `gridTemplateColumns`, `gridTemplateRows`, `gridAutoColumns`, `gridAutoRows`, `aspectRatio`.

- Replaced Tailwind’s default variable insertion (`*`, `::before`, `::after`) with `:root` based insertion.
