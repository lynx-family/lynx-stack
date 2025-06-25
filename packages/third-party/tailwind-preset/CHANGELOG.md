# @lynx-js/tailwind-preset

## 0.1.0

### Minor Changes

- Add createLynxPreset, expand Lynx plugin coverage, and enforce strict config types

  ### TypeScript Compatibility Fixes

  - Fixed type errors when using the Lynx Tailwind Preset in tailwind.config.ts.
  - Enforced strict typing on the Tailwind config object.
  - Removed the unofficial theme key 'outline'.
  - Refined types for createPlugin and createUtilityPlugin.

  ### Replaced & Updated Plugins

  - Removed deprecated variants() syntax (used only in Tailwind v1/v2).
  - **inset**: Replaced shorthand with explicit `top`, `right`, `bottom`, and `left` utilities.
  - **alignContent**: Removed values not supported by Lynx.
  - **rotate**: Added support for `rotateX`, `rotateY`, and `rotateZ` (aligns with Tailwind v4).
  - **skew & scale**: Updated their implementation to use the same `CSSTransformValue`.
  - **translate**: Added support for `translateZ`.
  - **transform**: Now supports `translateZ`, `rotateX`, `rotateY`, and `rotateZ`.
  - **display**: Added `relative` and `linear` values.
  - **textAlign**: Removed `justify`.
  - **overflow**: Removed unsupported values.
  - **boxShadow**: Uses Lynx-compatible color and shadow format; CSS variables not supported.
  - **backgroundClip**: Removed `text`.
  - **justifyContent**: Removed `normal`.
  - **visibility**: Removed `collapse`.
  - **whitespace**: Retains only `normal` and `nowrap`.
  - **wordBreak**: Removed `overflow-wrap` property and `keep-all` value.
  - **verticalAlign**: Now enabled via core plugin.
  - **gridColumn & gridRow**: Now implemented using longhand properties.

  ### Theme Object Refinements

  - **boxShadow**: Uses Lynx-compatible color formatting.
  - **transitionProperty**: Removed unsupported values: `filter`, `stroke`, `backdrop-filter`.
  - **zIndex**: Removed `auto`.
  - **gridTemplateColumns & gridTemplateRows**: Removed `subgrid` and `none`.
  - **gridAutoColumns & gridAutoRows**: Removed `min-content`.

  ### New: createLynxPreset Factory

  - Introduced `createLynxPreset()` to support:
    - Selective enabling/disabling of Lynx plugins.
    - Future per-plugin configuration.

  ### CSS Variable Defaults Overhaul

  - Replaced Tailwind’s default variable insertion (\*, ::before, ::after) with :root-based insertion.
  - Improves scoping and server-side rendering compatibility.

  ### Tailwind v3.4.17 JIT Default

  - JIT is now enabled by default.
  - No need to configure jit or set purge (this field has been renamed to content).

  ### Integration Notes: Tailwind Merge

  - Documented an issue where tailwind-merge may generate unused classes during bundling.
  - Caused by scanning source code in node_modules.
  - Added integration guidance in the README.

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
