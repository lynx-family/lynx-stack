# @lynx-js/tailwind-preset

## 0.4.0

### Minor Changes

- Enable `lynxUIPlugins` (incl. `uiVariants`) by default. Fills the gap left by missing pseudo- and data-attribute selectors in Lynx, offering state and structural variants out of the box. ([#1774](https://github.com/lynx-family/lynx-stack/pull/1774))

  Opt-out globally or per plugin:

  ```ts
  // disable all UI plugins
  createLynxPreset({ lynxUIPlugins: false });
  // or disable one plugin
  createLynxPreset({ lynxUIPlugins: { uiVariants: false } });
  ```

### Patch Changes

- Fixed transform-related CSS variables previously defined on `:root`; they are now reset on `*` to prevent inheritance between parent and child elements. ([#1773](https://github.com/lynx-family/lynx-stack/pull/1773))

## 0.3.0

### Minor Changes

- Added `group-*`, `peer-*`, and `parent-*` modifiers (ancestor, sibling, and direct-parent scopes) for `uiVariants` plugin. ([#1741](https://github.com/lynx-family/lynx-stack/pull/1741))

  Fixed prefix handling in prefixed projects — `ui-*` state markers are not prefixed, while scope markers (`.group`/`.peer`) honor `config('prefix')`.

  **BREAKING**: Removed slash-based naming modifiers on self (non-standard); slash modifiers remain supported for scoped markers (e.g. `group/menu`, `peer/tab`).

  Bumped peer dependency to `tailwindcss@^3.4.0` (required for use of internal features).

## 0.2.1

### Patch Changes

- Extend the `uiVariants` plugin with additional states: `initial`, `closed`, `indeterminate`, and `invalid`. These can be used with the `ui-*` prefix (e.g., `ui-initial`, `ui-closed`, `ui-indeterminate`, `ui-invalid`). ([#1663](https://github.com/lynx-family/lynx-stack/pull/1663))

## 0.2.0

### Minor Changes

- Add support for Lynx UI plugin system with configurable options. ([#1363](https://github.com/lynx-family/lynx-stack/pull/1363))

  - Introduced `lynxUIPlugins` option in `createLynxPreset`, allowing userland opt-in to Lynx UI specific plugins.

  - Implemented `uiVariants` plugin as the first UI plugin, supporting `ui-*` variant prefixes (e.g. `ui-checked`, `ui-open`) with customizable mappings.

## 0.1.2

### Patch Changes

- Improve transform transition compatibility with Lynx versions that do not support animating CSS variables. ([#1320](https://github.com/lynx-family/lynx-stack/pull/1320))

  - Added Lynx specific solo transform utilities that avoid CSS variables: `solo-translate-x-*`, `solo-scale-*`, `solo-rotate-*` etc. These utilities are implemented without CSS variables using raw transform functions such as `translateX()`, `scale()` and `rotate()`. They are mutually exclusive and cannot be combined with normal transform utilities.

  - Enabled arbitrary values for `transform-[...]`: e.g. `transform-[translateX(20px)_rotate(10deg)]`, following Tailwind v4 behavior.

- Fix `scale-*` utilities not supporting negative values. Now supports `-scale-x-100`, `-scale-y-50` as expected. ([#1320](https://github.com/lynx-family/lynx-stack/pull/1320))

- Add filter utilities: `blur-*`, `grayscale-*`. ([#1345](https://github.com/lynx-family/lynx-stack/pull/1345))

  - Note: On Lynx, filter functions are mutually exclusive, only one can be active at a time.

- Introduce scoped timing utilities with auto-derived repeat count for grouped transition properties, working around Lynx's lack of automatic value expansion. ([#1324](https://github.com/lynx-family/lynx-stack/pull/1324))

  - Scoped utilities like `duration-colors-*`, `ease-colors-*`, and `delay-colors-*` are generated when `transitionProperty.colors` contains multiple properties.

  - Scoped utilities like `duration-n-*`, `ease-n-*`,`delay-n-*` are generated when the `transitionProperty.DEFAULT` group contains multiple properties.

  - For single-property transitions (e.g., `transition-opacity`, `transition-transform`), you must use Tailwind's default `duration-*`, `ease-*`, and `delay-*` utilities, no scoped timing utilities will be generated in these cases.

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
