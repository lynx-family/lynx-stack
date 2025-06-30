---
"@lynx-js/tailwind-preset": minor
---

Add createLynxPreset, expand Lynx plugin coverage, and enforce strict config types

#### TypeScript Compatibility Fixes

- Fixed type errors when using the Lynx Tailwind Preset in `tailwind.config.ts`.
- Enforced strict typing on the Tailwind config object.
- Removed the unofficial theme key `outline`.
- Refined types for `createPlugin` and `createUtilityPlugin`.

#### Replaced & Updated corePlugins

- Removed deprecated `variants()` syntax (used only in Tailwind v1/v2).

- **inset**: Replaced shorthand with explicit `top`, `right`, `bottom`, and `left` utilities.

- **rotate**: Added support for `rotateX`, `rotateY`, and `rotateZ` (aligns with Tailwind v4).
- **translate**: Added support for `translateZ`.
- **skew & scale**: Updated their implementation to use the same `CSSTransformValue`.
- **transform**: Now supports `translateZ`, `rotateX`, `rotateY`, and `rotateZ` utilities.
- **boxShadow**: Uses Lynx-compatible color and shadow format; CSS variables not supported due to a boxShadow rendering bug.
- **gridColumn & gridRow**: Now implemented using longhand properties.
- **display**: Added `relative` and `linear` values.
- **alignContent**: Removed values not supported by Lynx.
- **textAlign**: Removed `justify`.
- **overflow**: Removed unsupported values.
- **backgroundClip**: Removed `text`.
- **justifyContent**: Removed `normal`.
- **visibility**: Removed `collapse`.
- **whitespace**: Retains only `normal` and `nowrap`.
- **wordBreak**: Removed `overflow-wrap` property and `keep-all` value.

#### Enabled the following utilities via Tailwind core plugins:

- **verticalAlign**
- **justifyItems**
- **justifySelf**
- **size**
- **flexBasis**
- **textIndent**

#### Added Lynx Specific Plugin(s)

- **direction**: add Lynx specific plugin to handle `ltr`, `rtr` and `lynx-ltr`.

#### Theme Object Refinements

- **boxShadow**: Uses Lynx-compatible color formatting.
- **transitionProperty**: Removed unsupported values: `filter`, `stroke`, `backdrop-filter`.
- **zIndex**: Removed `auto`.
- **gridTemplateColumns & gridTemplateRows**: Removed `subgrid` and `none`.
- **gridAutoColumns & gridAutoRows**: Removed `min-content`.

#### New: createLynxPreset Factory

- Introduced `createLynxPreset()` to support:
- Selective enabling/disabling of Lynx plugins.
- Future per-plugin configuration.

#### CSS Variable Defaults Overhaul

- Replaced Tailwind’s default variable insertion (`*`, `::before`, `::after`) with `:root` based insertion.

#### Tailwind v3.4.17 JIT Default

- JIT is now enabled by default.
- No need to configure jit or set purge (this field has been renamed to content).

#### Integration Notes: Tailwind Merge

- Documented an issue where tailwind-merge may generate unused classes during bundling.
- Caused by scanning source code in `node_modules`.
- Added integration guidance in the `README.md`.
