# Preset Extensions

`@lynx-js/tailwind-preset` provides additions outside Tailwind CSS v3's
sidebar taxonomy. They include Lynx-specific utilities and variants, plus
selected Tailwind CSS v4 utility syntax and utility families implemented by
this preset. They are documented separately so the
[Tailwind CSS v3 support matrix](./tailwind-css-v3-support.md) remains a
direct comparison with Tailwind's standard utility groups.

This document does not claim Tailwind CSS v4 compatibility. Tailwind CSS v4
support and its CSS dependencies, including `color-mix()`, are out of scope.

## Transforms

Tailwind's composed transform utilities build one `transform` value from
`--tw-*` CSS variables. The utilities below write raw transform values instead.

### Arbitrary Transform Values (v4 Syntax)

Use an arbitrary transform value such as `transform-[translateX(20px)]` for
an explicit raw transform value. This Tailwind CSS v4-style syntax is
implemented by this v3 preset and can express multiple operations in one
value, for example
`transform-[translateX(20px)_rotate(10deg)]`.

Because this utility writes `transform` directly, it is the recommended option
for one-off animated transforms that must support Lynx SDK versions before
3.4.

### Standalone Transform Utilities

Lynx SDK versions before 3.4 cannot animate CSS variables. The `solo-*`
utilities provide theme-backed raw transform functions for that compatibility
case:

- `solo-translate-*`
- `solo-rotate-*`
- `solo-scale-*`
- `solo-skew-*`

Use `solo-*` when a theme-backed standalone utility is more appropriate.
Both `solo-*` and `transform-[...]` write the `transform` property, so they
are mutually exclusive with Tailwind's composed transform utilities. This
compatibility behavior was introduced in
[#1320](https://github.com/lynx-family/lynx-stack/pull/1320).

### Perspective (v4 Adaptation)

`perspective-{dramatic,near,normal,midrange,distant}` uses the distance scale
from [Tailwind CSS v4][tailwind-perspective]. The reset utility differs:
Tailwind CSS v4 provides `perspective-none`, while this preset provides
`perspective-auto` to restore the Lynx default value.

Perspective is not a Tailwind CSS v3 sidebar item. On native Lynx, the
`perspective` property affects the current element and can be combined with
`translate-z-*`, `rotate-x-*`, and `rotate-y-*` on that element. Lynx for Web
follows Web behavior, where the property affects transformed descendants.
See the [Lynx perspective documentation][lynx-perspective] for this platform
difference.

This utility family was introduced in
[#1161](https://github.com/lynx-family/lynx-stack/pull/1161).

## Direction

The Lynx `direction` plugin provides:

- `normal`
- `ltr`
- `rtl`
- `lynx-rtl`

`direction` is not a Tailwind CSS v3 sidebar utility, so it is intentionally
documented here rather than in the support matrix.

## UI State Variants

On the web, Tailwind CSS v3 commonly expresses component state with
[data attribute variants](https://tailwindcss.com/blog/tailwindcss-v3-2#data-attribute-variants)
such as `data-[state=open]:bg-blue-500`,
`group-data-[state=open]:...`, and `peer-data-[disabled]:...`. These variants
compile to CSS attribute selectors.

Lynx supports only a small subset of pseudo-selectors and does not support the
CSS attribute selectors required by these variants. The `uiVariants` plugin is
enabled by default as a class-based alternative: use `ui-open:bg-blue-500`
instead of `data-[state=open]:bg-blue-500`.

The default `ui-*` family includes self-state variants such as
`ui-open:bg-blue-500`. It also provides scoped forms:

- `group-ui-*` for ancestor state
- `peer-ui-*` for sibling state
- `parent-ui-*` for direct-parent state

See [UI Variants](./plugins/lynx-ui/uiVariants.md) for built-in and opt-in
state values, custom or extended prefix-to-state mappings, and generated
selector examples.

[lynx-perspective]: https://lynxjs.org/api/css/properties/perspective
[tailwind-perspective]: https://tailwindcss.com/docs/perspective
