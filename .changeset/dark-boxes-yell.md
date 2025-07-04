---
"@lynx-js/tailwind-preset": minor
---

Expand Lynx plugin coverage.

- Added v3 utilities: `align-*`, `basis-*`, `col-*`, `inset-*`, `justify-items-*`, `justify-self-*`, `row-*`, `shadow-*`, `size-*`, `indent-*`, `aspect-*`, `animation-*`.

- Added v4 utilities: `rotate-x-*`, `rotate-y-*`, `rotate-z-*`, `translate-z-*`, `perspective-*`.

- Added Lynx specific utilities: `display-relative`, `linear`, `ltr`, `rtr`, `normal`, `lynx-ltr`.

- Refined Lynx compatiable utilities: `bg-clip-*`, `content-*`, `text-*`(textAlign), `justify-*`, `overflow-*`, `whitespace-*`, `break-*`.

- Removed Lynx uncompatiable utilties: `collapse`.

- Refined Lynx compatiable theme object: `boxShadow`, `transitionProperty`, `zIndex`, `gridTemplateColumns`, `gridTemplateRows`, `gridAutoColumns`, `gridAutoRows`, `aspectRatio`.

- Replaced Tailwind’s default variable insertion (`*`, `::before`, `::after`) with `:root` based insertion.
