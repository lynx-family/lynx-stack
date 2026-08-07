---
"@lynx-js/web-core": minor
---

Build a single file Lynx XML markup document into a `.web.bundle`.

`@lynx-js/web-core/encode` gains `encodeLynxXML(source)` and `xmlToTasmJSON(source)`,
which turn a hand-written Lynx XML document - a versioned `<lynx>` root wrapping an
optional `<style>`, a required `<script main-thread>` and an optional
`<script background>` - into the same bundle bytes a ReactLynx build produces: same
magic header, same section sequence, same rkyv-encoded `StyleInfo`. Nothing
downstream has to know the card was hand-written, and no new decode path is
introduced.

Because the stylesheet is tokenized into the bundle rather than passed through as
text, a markup card gets the engine's full style pipeline:

- the `transform-vw` / `transform-vh` / `transform-rem` attributes apply, so those
  units resolve against the `lynx-view` box. They remain off by default, in which
  case the units keep their native browser meaning.
- Lynx-specific property rewriting runs, so `display: linear` and the `linear-*`
  properties are translated instead of being discarded by the browser as invalid.
- `:root` is rewritten to the card's own root element. A card renders inside a
  shadow root, where a literal `:root` matches nothing.

A parse failure is returned rather than thrown, formatted like the engine's
reference parser and located by offset.

**At-rules that Lynx does not support are dropped from the bundle.** This is
intended, not a limitation of the web implementation: Lynx's binary style format
has exactly three rule kinds - style, `@font-face` and `@keyframes` - so a
conditional group has no representation on any Lynx platform. Concretely, in a
markup card's `<style>`:

- `@media`, `@supports` and `@layer` do not apply. The rules inside them are
  dropped with them; they are not promoted to the top level, so a card renders as
  though those blocks had not been written.
- `@container`, `@property`, `@scope`, `@starting-style`, `@page`, `@charset` and
  `@namespace` are not recognised by the Lynx CSS parser and are dropped the same
  way, along with anything inside them.
- `@import url("...")` does not resolve. A markup card owns a single stylesheet and
  has nothing to link to, so it is dropped rather than aborting the build. The
  numeric form a build step emits is unaffected.
- `@font-face` and `@keyframes` **nested inside** one of the above are dropped with
  their enclosing block, even though both are supported at the top level.

Every one of these is reported on the console during the build, once per at-rule,
naming the at-rule and why it could not be carried - so the cause is visible rather
than showing up later as a rendering difference with nothing to go on.

The existing encode path is untouched: `encodeCSS` and `encode` are byte for byte
unchanged, and a ReactLynx build produces exactly the bundle it produced before.
