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

Remaining limitation: `@media`, `@supports`, `@layer` and `@import` have no
representation in the binary style format, whose rule kinds are only style,
`@font-face` and `@keyframes`. Such a block is passed through to the browser
verbatim, which honours it natively, but the CSS inside it is **not** tokenized -
so the three rewrites above do not apply there. Declarations outside those blocks
are unaffected, and their relative order with the rest of the stylesheet is
preserved.

Tokenizing at load time needs a CSS parser in the decode Worker, so `css-tree` is
now a dependency of this package. It is bundled only into the template loader
chunk, which is where the decode Worker runs, and does not affect the main thread
bundle.
