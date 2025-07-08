# @lynx-js/tailwind-preset

## 0.1.1

### Patch Changes

- Fix output not found when publishing. ([#1225](https://github.com/lynx-family/lynx-stack/pull/1225))

## 0.1.0

### Minor Changes

- Expand Lynx plugin coverage. ([#1161](https://github.com/lynx-family/lynx-stack/pull/1161))

  - Added v3 utilities: `align-*`, `basis-*`, `col-*`, `inset-*`, `justify-items-*`, `justify-self-*`, `row-*`, `shadow-*`, `size-*`, `indent-*`, `aspect-*`, `animation-*`.

  - Added v4 utilities: `rotate-x-*`, `rotate-y-*`, `rotate-z-*`, `translate-z-*`, `perspective-*`.

  - Added Lynx specific utilities: `display-relative`, `linear`, `ltr`, `rtr`, `normal`, `lynx-ltr`.

  - Refined Lynx compatiable utilities: `bg-clip-*`, `content-*`, `text-*`(textAlign), `justify-*`, `overflow-*`, `whitespace-*`, `break-*`.

  - Removed Lynx uncompatiable utilties: `collapse`.

  - Refined Lynx compatiable theme object: `boxShadow`, `transitionProperty`, `zIndex`, `gridTemplateColumns`, `gridTemplateRows`, `gridAutoColumns`, `gridAutoRows`, `aspectRatio`.

  - Replaced Tailwind’s default variable insertion (`*`, `::before`, `::after`) with `:root` based insertion.

- Fix type errors when using the Lynx Tailwind Preset in `tailwind.config.ts`. ([#1161](https://github.com/lynx-family/lynx-stack/pull/1161))

- Add `createLynxPreset()` Factory: enabling/disabling of Lynx plugins. ([#1161](https://github.com/lynx-family/lynx-stack/pull/1161))

## 0.0.4

### Patch Changes

- Avoid publishing test files. ([#1125](https://github.com/lynx-family/lynx-stack/pull/1125))

## 0.0.3

### Patch Changes

- Support `hidden`, `no-underline` and `line-through` utilities. ([#745](https://github.com/lynx-family/lynx-stack/pull/745))

## 0.0.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.0.1

### Patch Changes

- c5e3416: New Package `@lynx-js/tailwind-preset` to include lynx-only tailwindcss features
