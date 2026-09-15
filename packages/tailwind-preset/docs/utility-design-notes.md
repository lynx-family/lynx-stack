# Utility Design Notes

This maintainer-facing document records implementation constraints and open
decisions for utility families where Lynx runtime capabilities and Tailwind's
composition model do not yet align.

This document is not a support contract or a roadmap commitment. The
[Tailwind CSS v3 support matrix](./tailwind-css-v3-support.md) remains the
source for current preset behavior. An implementation PR must update that
matrix, CLI coverage, and runtime restrictions together.

The default preset compatibility baseline is OSS Lynx SDK 3.2. Features that
require a newer SDK must preserve SDK 3.2 output, provide an explicit opt-in
path, or intentionally raise the baseline.

A property can remain registered in Lynx CSS definitions even when it is no
longer recommended for new code. Before treating it as a preset candidate,
check whether Lynx intends to continue supporting it, as well as its target
and SDK compatibility, public documentation, and runtime behavior.

## Tailwind CSS v4 Changes

This package remains a Tailwind CSS v3 preset. Tailwind CSS v4 is useful as
design input, but its class names and output are not automatically part of the
preset's compatibility contract.

The v4 documentation consolidates some utility families into property pages.
Space Between now appears under [Margin][tailwind-v4-space], and Divide appears
under [Border Width][tailwind-v4-divide]. Neither family was removed.

The [v4 upgrade guide][tailwind-v4-upgrade] identifies changes that affect
future preset decisions:

- **Transform composition:** Translate, Rotate, and Scale use individual CSS
  properties. Their reset and transition behavior differs from v3.
- **Selector-based utilities:** Space Between and Divide use a faster
  `> :not(:last-child)` selector and write to the preceding child's ending
  side.
- **Removed opacity utilities:** `bg-opacity-*`, `border-opacity-*`,
  `divide-opacity-*`, `text-opacity-*`, and related families were removed in
  favor of slash modifiers.
- **Renamed utilities and scales:** Shadow, Drop Shadow, Blur, Backdrop Blur,
  Border Radius, Outline, and Ring names or defaults changed. A v4-inspired
  extension must define whether it adopts v3 compatibility names or v4
  semantics.
- **Changed composition and defaults:** Gradient variants preserve unspecified
  stops, while bare Border, Divide, and Ring utilities use different default
  colors or widths.
- **Changed syntax and variant order:** CSS-variable arbitrary values use
  parentheses, and order-sensitive stacked variants apply left to right.

These changes are evaluated by utility family below. They do not justify
changing existing v3-compatible output without a separate compatibility
decision.

## Transform Composition

**Tailwind CSS v3**

The v3 [Translate, Rotate, Skew, and Scale Core plugins][tailwind-v3-transform-source]
update shared variables and repeat the same complete `transform` declaration:

```css
transform: translate(var(--tw-translate-x), var(--tw-translate-y))
  rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y))
  scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
```

The Transform Core plugin registers initial values through Tailwind's internal
`addDefaults` hook, and the component utilities request them with
`@defaults transform`. `addDefaults` is not part of Tailwind v3's public
`PluginAPI`, so a preset plugin cannot reproduce this mechanism without
depending on Tailwind internals.

The Translate, Rotate, Skew, and Scale Core plugins depend on defaults
registered by the separate Transform Core plugin. Enabling those component
plugins alone can leave variables unset and invalidate the composed
declaration.

The fixed function list makes class order irrelevant and lets `transform-none`
reset the complete composition. `transform-gpu` changes only the leading
function from `translate(...)` to `translate3d(..., 0)`.

**Current Lynx adaptation**

Lynx exposes the `transform` property and transform functions, but not the
individual `translate`, `rotate`, and `scale` CSS properties used by v4. The
preset therefore retains one composed declaration and adds native 3D axes:

```css
transform: translate3d(var(--tw-tx), var(--tw-ty), var(--tw-tz))
  rotateX(var(--tw-rx)) rotateY(var(--tw-ry)) rotateZ(var(--tw-rz))
  skew(var(--tw-skx), var(--tw-sky)) scale(var(--tw-sx), var(--tw-sy));
```

The `defaults` plugin initializes the abbreviated variables on `*`. Each
component utility updates one or more variables and writes the complete
declaration. `transform-[...]` and `solo-*` instead write a raw `transform`
value, so they are mutually exclusive with the composed utilities.

Tailwind CSS v3 does not provide the `transform-[...]` utility syntax. The
preset adds it as a selected v4-style extension. Raw `transform-[...]` values
are the recommended path for animated transforms targeting Lynx SDK versions
before 3.4. The `solo-*` utilities provide theme-backed raw values for the same
compatibility case.

The v3 Core family can produce valid basic 2D transforms on Lynx where CSS
variables are supported. It is not a complete replacement for the Lynx
plugins: its default generation is browser-oriented, it does not provide the
Lynx 3D-axis extensions, and variable-driven transform animations require
Lynx SDK 3.4+.

`translate3d(x, y, 0)` matches the geometry of `translate(x, y)`,
`rotateZ(a)` matches `rotate(a)`, and `scale(x, y)` matches
`scaleX(x) scaleY(y)`. The current `transform-cpu` and `transform-gpu`
utilities also emit the same declaration because the common chain always
starts with `translate3d`.

Skew has a compatibility issue. `skewX(x) skewY(y)` and `skew(x, y)` produce
different matrices when both angles are non-zero. Single-axis use is
equivalent, which is all the current CLI fixture demonstrates. The shorthand
keeps the composed declaration shorter but does not preserve v3 semantics when
both Skew axes are present.

**Tailwind CSS v4**

As of v4.3.3, [Tailwind's implementation][tailwind-v4-transform-source] emits
the individual `translate`, `rotate`, and `scale` properties for the
corresponding 2D utilities. Axis variables are registered with non-inheriting
`@property` rules. The `rotate-{x,y,z}-*` and `skew-*` families still compose
function-valued variables into `transform`.

CSS applies [the individual properties in the fixed order][mdn-transform]
`translate`, `rotate`, and `scale`, followed by `transform`. This moves v4 Skew
after Scale when both families are present, unlike the v3 function list. The
v4 `transform-none` utility resets only `transform`; separate
`translate-none`, `rotate-none`, and `scale-none` utilities reset the
individual properties. Likewise, v4 `transition-transform` includes
`transform`, `translate`, `scale`, and `rotate`.

This model cannot be ported directly while Lynx lacks the individual
properties. It is still useful as evidence that Transform resets, transition
property lists, function order, inheritance, and 2D/3D composition must be
designed together.

**Decision required**

A follow-up implementation must:

1. Add runtime coverage for combined `skew-x-*` and `skew-y-*`, mixed
   Scale/Skew, reset, transition, `solo-*`, and arbitrary-transform cases on
   native Lynx and Lynx for Web.
2. Decide whether to restore the v3 `skewX(...) skewY(...)` chain. The change
   would alter existing combined Skew output and animations, so it is a
   user-visible breaking change. While the package remains pre-1.0, release it
   with a minor changeset.
3. Define whether `transform-cpu` and `transform-gpu` should remain aliases or
   regain distinct output.
4. Preserve the single-property Lynx model unless runtime support for the
   individual properties is added and versioned.

## Text Decoration Composition

**Current behavior**

Tailwind expects its line, color, style, and thickness utilities to compose.
For example, `underline`, `decoration-red-500`, `decoration-dotted`, and
`decoration-2` may be applied to the same element.

The preset currently emits the `text-decoration` shorthand for `underline`,
`line-through`, and `no-underline` because Lynx does not support the
`text-decoration-line` longhand. A shorthand declaration resets omitted
decoration components, so enabling Tailwind's longhand Core plugins directly
would make composition depend on CSS output order.

**Lynx capabilities**

The [Lynx text-decoration documentation][lynx-text-decoration] describes these
capabilities:

- `text-decoration-color` is available as a longhand, but its minimum Lynx SDK
  version is not documented.
- Decoration style is accepted only inside the `text-decoration` shorthand;
  the `text-decoration-style` longhand is unavailable.
- `text-decoration-thickness` is available as a longhand on Android and iOS in
  Lynx SDK 4.0+. Harmony, Clay, and Lynx for Web do not support it.

**Decision required**

A follow-up implementation must choose between:

1. Keeping the shorthand-based line utilities and introducing a Lynx
   composition model for line, color, style, and thickness. This requires an
   explicit SDK baseline and defined behavior when multiple decoration
   utilities are combined.
2. Waiting for `text-decoration-line` longhand support, then changing the line
   plugin to emit that longhand and enabling the compatible Tailwind Core
   plugins. Style would still require a Lynx replacement until its longhand is
   supported.

Until that decision is made, Text Decoration Color, Style, and Thickness
remain unsupported by the preset.

## Box Shadow Composition

**Current behavior**

The Lynx `boxShadow` plugin resolves named theme values and arbitrary shadow
values, then writes `box-shadow` directly. It does not initialize or compose
Tailwind's `--tw-shadow-*` and `--tw-ring-*` variables.

As a result:

- `shadow`, named `shadow-*`, and `shadow-[<shadow>]` utilities are available.
- Shadow Color and Ring utilities cannot compose with those shadows.
- An arbitrary shadow value replaces the complete `box-shadow` declaration.

**Lynx capabilities**

Lynx SDK 3.6+ supports the nested CSS variables required by Tailwind's shadow
composition model, which is above the current SDK 3.2 baseline.

**Compatibility risk**

Changing the existing `shadow-*` utilities from direct declarations to
variable-composed declarations would alter the CSS emitted for every existing
shadow class. It could also raise the minimum SDK requirement for behavior
that currently works without nested variables.

**Decision required**

A follow-up implementation must decide:

1. Whether to preserve direct shadow output by default and make composition
   opt-in for SDK 3.6+ applications.
2. Whether the preset can raise its default SDK baseline and migrate existing
   `shadow-*` output to Tailwind-style variables.
3. Whether Shadow Color and Ring support should ship together or as separately
   validated capabilities.

## Brightness, Contrast, and Saturate Filters

**Current behavior**

The preset provides direct `filter` declarations for Blur, Grayscale, and
`filter-none`. These utilities are mutually exclusive because Lynx allows only
one filter function in each declaration.

Tailwind's Core filter plugins use CSS variables to compose multiple filter
functions. That output is incompatible with Lynx's one-function limit, so the
Core Brightness, Contrast, and Saturate plugins cannot be enabled directly.

**Lynx capabilities**

The [Lynx filter documentation][lynx-filter] lists `brightness()`, `contrast()`,
and `saturate()` among the supported functions in SDK 3.6+. Direct Lynx
replacements can follow the existing Blur and Grayscale plugins, with each
utility writing one complete `filter` value.

This is suitable for an additive follow-up: existing CSS remains unchanged,
and only applications that use these classes opt in to the SDK 3.6+
requirement. The utilities would remain mutually exclusive with the existing
Filter utilities and with each other. The implementation still needs
deterministic registry order, CLI coverage, and cross-platform runtime
validation.

## Sibling-Based Spacing and Borders

**Tailwind CSS v3**

The v3 Space Between and Divide Core plugins target every visible child after
the first with `> :not([hidden]) ~ :not([hidden])`. Space writes a starting-side
margin on those children. Divide writes a starting-side border.

The selector can be expensive on large pages. Tailwind v4 retained both
utility families but changed their selector to `> :not(:last-child)` to address
that performance issue. The declaration also moved to the ending side of every
child before the last:

```css
/* v3 */
.space-y-4 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1rem;
}

/* v4 */
.space-y-4 > :not(:last-child) {
  margin-bottom: 1rem;
}
```

Divide changed in the same way, from a starting-side border on later children
to an ending-side border on earlier children. These forms have similar basic
visual output, but differ for hidden or inline children and when child margins,
padding, or borders are customized.

**Current preset**

The preset does not enable the v3 Core plugins. A future implementation must
adapt rather than copy them because the complete output depends on selector
support, `[hidden]` semantics, CSS calculations, reverse variables, and Divide
Color opacity behavior. Reverse composition requires Lynx SDK 3.6+, above the
OSS SDK 3.2 baseline.

**Decision required**

A follow-up implementation must decide:

1. Whether Lynx can use and efficiently invalidate the v4
   `> :not(:last-child)` selector across targets. The known v3 performance
   problem makes its general-sibling selector a poor default for a new
   replacement.
2. Whether exact `[hidden]` filtering is required, and which child receives the
   margin or border when matching behavior cannot be identical across targets.
3. Whether SDK 3.2 should receive a partial implementation without reverse
   utilities, or the complete family should require SDK 3.6+.
4. Whether Space Between and the Divide families should be introduced
   together or validated independently.
5. How Divide Color should interact with slash opacity modifiers while the
   legacy `divideOpacity` plugin remains disabled.

Tailwind recommends a flex or grid layout with `gap` when the v4 Space
selector change exposes an incompatibility. The existing `gap-*` utilities are
also the preferred SDK 3.2-compatible option for ordinary Lynx layouts, but
they are not a semantic replacement for spacing arbitrary siblings or for
Divide.

## Color Opacity

**Current behavior**

The preset does not customize Tailwind CSS v3's slash opacity modifier
behavior. The enabled Tailwind Core color plugins preserve direct output for
colors without a modifier:

```css
.bg-red-500 {
  background-color: #ef4444;
}
```

Slash opacity modifiers already compile to modern color syntax:

```css
.bg-red-500\/50 {
  background-color: rgb(239 68 68 / 0.5);
}
```

The same behavior applies to the enabled Background Color, Border Color, Text
Color, and Caret Color families. For default palette and static custom colors,
Tailwind resolves the color at build time and emits a self-contained
`rgb(... / alpha)` value. That syntax requires Lynx SDK 3.4+ on native
targets. Unmodified colors retain their SDK 3.2-compatible direct output.

**CSS-variable colors**

Tailwind cannot inject alpha into a theme color that references a complete
color value:

```js
colors: {
  primary: 'var(--primary)',
}
```

An alpha-aware color reference must expose color channels to Tailwind:

```js
colors: {
  primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
}
```

This form generates `rgb(var(--primary-rgb) / 0.5)` for `bg-primary/50`.
Unlike a static color, the generated value contains a CSS variable inside a
color function. Native use therefore requires Lynx SDK 3.6+ nested-variable
support in addition to modern RGB syntax. This path still needs cross-platform
runtime validation.

Lynx for Web follows browser behavior for both static and CSS-variable colors.

The legacy `backgroundOpacity`, `borderOpacity`, and `textOpacity` Core plugins
remain disabled. Enabling one of them would also change the corresponding base
color utilities from direct declarations to variable-composed declarations,
for example:

```css
.bg-red-500 {
  --tw-bg-opacity: 1;
  background-color: rgb(239 68 68 / var(--tw-bg-opacity));
}
```

That is a compatibility change for every existing color class, not only an
addition of `bg-opacity-*`, `border-opacity-*`, or `text-opacity-*`.

**Decision required**

The preferred direction is to preserve Tailwind's slash modifier behavior
without changing unmodified color output. A follow-up must decide whether the
preset should formally recommend an alpha-aware RGB-channel convention for
CSS-variable theme colors.

Before expanding the support contract:

1. Add CLI coverage for static custom colors, complete color variables, and
   alpha-aware channel variables.
2. Verify static slash colors on native SDK 3.4+ and nested-variable colors on
   native SDK 3.6+, plus Lynx for Web.
3. Define the documented behavior for custom theme and arbitrary colors.
4. Decide whether the legacy variable-based opacity plugins are needed for
   compatibility. They should remain disabled unless that requirement is
   established.

## Gradient Color Stops

**Current behavior**

The preset enables Tailwind's Background Image Core plugin but leaves Gradient
Color Stops disabled. `bg-none` and complete arbitrary image values such as
`bg-[linear-gradient(...)]` write a self-contained `background-image`
declaration and are supported.

Directional classes such as `bg-gradient-to-r` reference
`var(--tw-gradient-stops)`. Without the `from-*`, `via-*`, and `to-*` utilities,
that variable is not initialized, so directional gradients are not part of the
supported Background Image scope.

**Lynx capabilities**

Tailwind's Gradient Color Stops plugin composes stop colors and optional
positions through nested CSS variables. Lynx SDK 3.6+ provides the required
variable support, which is above the OSS SDK 3.2 baseline. Stop colors with
slash opacity modifiers also use the modern color syntax available in SDK
3.4+.

**Decision required**

A follow-up implementation must decide:

1. Whether to enable Tailwind's Core Gradient Color Stops plugin and treat use
   of gradient classes as an application-level opt-in to SDK 3.6+.
2. Whether a Lynx replacement should emit complete gradient values without
   variable composition. That approach would need a different composition
   model for independently selected `from-*`, `via-*`, and `to-*` classes.
3. Whether directional `bg-gradient-to-*` classes should remain unavailable
   until color stops are implemented.
4. Which two-stop, three-stop, stop-position, custom-color, and opacity cases
   require CLI and cross-platform runtime coverage.

## Font Feature Settings

**Current behavior**

Tailwind CSS v3's Font Variant Numeric utilities emit
`font-variant-numeric`, which Lynx does not support. Lynx instead provides the
lower-level
[font-feature-settings][lynx-font-feature-settings] property on Android and
iOS in SDK 3.4+, and on Web. Harmony and Clay do not support the property. The
iOS implementation accepts only its documented set of registered OpenType
tags, including the standard numeric-feature tags.

Tailwind's Font Family Core plugin can also emit `font-feature-settings` and
`font-variation-settings` when those options are supplied by a theme entry.
The latter has the same Android/iOS SDK 3.4+ and Web target scope, without the
iOS tag restriction.

Mapping the v3 utility names onto `font-feature-settings` would not be fully
equivalent. A generated declaration could replace other OpenType features
configured by the user or by a font-family theme entry.

**Candidate extension**

Rather than emulate `font-variant-numeric`, the preset could implement the
[direct arbitrary-value syntax][tailwind-font-feature-settings] documented by
Tailwind CSS v4:

```html
<text className="font-features-['tnum']" />
<text className="font-features-['smcp','onum']" />
```

This makes the complete `font-feature-settings` value explicit and leaves
feature composition under application control. It would be a selected v4
utility extension, not support for the Tailwind CSS v3 Font Variant Numeric
family.

**Decision required**

A follow-up implementation must decide:

1. Whether to support only arbitrary values or also the v4 custom-property
   shorthand.
2. Which target platforms form the supported baseline.
3. How the utility interacts with `fontFeatureSettings` supplied through
   Tailwind font-family theme entries.
4. Whether any named feature aliases are necessary. They should not reuse the
   v3 numeric class names unless equivalent semantics can be guaranteed.

## Hyphens

Lynx defines `hyphens` with the `none`, `manual`, and `auto` values used by
Tailwind. Android and iOS currently reduce the property to an automatic
hyphenation switch, so `hyphens-none` and `hyphens-manual` have the same native
behavior. Enabling this family requires cross-target validation and an explicit
decision on whether that semantic difference is acceptable.

## Pointer Events and Cursor

Tailwind's `pointer-events-{auto,none}` declarations match the Lynx property
values directly. The property is available on native targets in SDK 3.5+ and
on Clay, but is unavailable on Lynx for Web. Supporting it requires a
target-specific contract above the default SDK 3.2 baseline.

Cursor utilities are available on Lynx for Web and have partial keyword-only
support on Clay macOS and Windows in SDK 3.7+. Mobile native targets do not
support the property, so the complete Tailwind Cursor family cannot be enabled
as a cross-target default.

## Place Content, Items, and Self

Lynx does not define the `place-content`, `place-items`, or `place-self`
shorthands, but it supports the corresponding align and justify longhands. A
Lynx replacement could expand each Place utility into those longhands, as the
preset already does for Inset and Grid placement.

For example:

```css
.place-content-center {
  align-content: center;
  justify-content: center;
}

.place-items-start {
  align-items: start;
  justify-items: start;
}

.place-self-center {
  align-self: center;
  justify-self: center;
}
```

A value can be replaced only when both longhands support it. Place Content can
cover `start`, `end`, `center`, `space-between`, `space-around`, and `stretch`,
but not `baseline` or `space-evenly`. Place Items can cover `start`, `end`,
`center`, and `stretch`, but not `baseline`. Place Self can cover its complete
default set: `auto`, `start`, `end`, `center`, and `stretch`.

For example, these classes cannot be expanded faithfully:

```css
.place-content-evenly {
  align-content: space-evenly; /* Not supported by Lynx. */
  justify-content: space-evenly; /* Supported by Lynx. */
}

.place-items-baseline {
  align-items: baseline; /* Supported by Lynx. */
  justify-items: baseline; /* Not supported by Lynx. */
}
```

Emitting only the supported declaration would change the two-axis semantics of
the Place utility. Each replacement still requires CLI and cross-platform
layout validation.

[lynx-filter]: https://lynxjs.org/api/css/properties/filter#differences-from-the-web
[lynx-font-feature-settings]: https://lynxjs.org/api/css/properties/font-feature-settings.html
[lynx-text-decoration]: https://lynxjs.org/api/css/properties/text-decoration
[mdn-transform]: https://developer.mozilla.org/en-US/docs/Web/CSS/transform
[tailwind-v3-transform-source]: https://github.com/tailwindlabs/tailwindcss/blob/v3.4.19/src/corePlugins.js#L533-L539
[tailwind-v4-divide]: https://tailwindcss.com/docs/border-width#between-children
[tailwind-v4-space]: https://tailwindcss.com/docs/margin#adding-space-between-children
[tailwind-v4-transform-source]: https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/packages/tailwindcss/src/utilities.ts#L1351-L1708
[tailwind-v4-upgrade]: https://tailwindcss.com/docs/upgrade-guide
[tailwind-font-feature-settings]: https://tailwindcss.com/docs/font-feature-settings
