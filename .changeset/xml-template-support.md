---
"@lynx-js/web-core": minor
---

Support rendering buildless Lynx XML markup templates.

A `lynx-view` whose `url` points at a single file Lynx XML document now loads and
renders it directly, with no Rspeedy/ReactLynx build step. The document is a
versioned `<lynx>` root wrapping an optional `<style>`, a required
`<script main-thread>` and an optional `<script background>`; the UI tree is
built by the main-thread script through the Element PAPIs.

The format is detected by content sniffing, mirroring the existing bypass for
JSON artifacts, so a static file server does not have to cooperate on
`Content-Type`. A parse failure is reported through the `lynx-view` error event
and locates the problem by offset. Internally the document is translated into the
JSON artifact shape and handed to the existing assembly path, so all three
artifact formats emit the same section sequence.

The CSS carried by `<style>` is tokenized, so a markup card goes through the same
style pipeline as a built one:

- the `transform-vw` / `transform-vh` / `transform-rem` attributes apply, so
  those units resolve against the `lynx-view` box. They remain off by default, in
  which case the units keep their native browser meaning.
- Lynx-specific property rewriting runs, so `display: linear` and the `linear-*`
  properties are translated.
- `:root` is rewritten to the card's own root element. A card renders inside a
  shadow root, where a literal `:root` matches nothing, so without this rules and
  custom properties declared under `:root` would never reach the card.
- `@font-face` and `@keyframes` are tokenized too, both being rule kinds the
  binary style format represents natively.

An at-rule the format has no rule kind for is **discarded**, along with the rules
inside it: `@media`, `@supports` and `@layer` have no representation in it and are
therefore not Lynx features on any platform, and `@import` can only link numeric
css ids, which a markup card - owning a single stylesheet - has nothing to do
with. Keeping them for the browser to honour would give a web-only markup card a
capability native does not have, so a markup card's CSS capabilities are instead
exactly a built card's; this matches how `encode`'s markup entry already builds a
bundle from the same document. Because none of it is a CSS error, every drop is
reported on the console once per at-rule kind, in development builds only.

Tokenizing at load time needs a CSS parser in the decode Worker, so `css-tree` is
now a dependency of this package. It does not affect the main thread bundle, and
it is loaded through a dynamic `import()` rather than bundled into the decode
Worker's chunk, so it is fetched only once a markup card with a `<style>` section
is actually loaded - a card produced by a build step arrives already tokenized and
never pays for it.
