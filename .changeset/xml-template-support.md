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

Known limitation: the CSS carried by `<style>` reaches the style pipeline
verbatim rather than tokenized. Three consequences:

- the `transform-vw` / `transform-vh` / `transform-rem` attributes do not apply.
  Browsers resolve `rem`, `vh` and `calc()` natively, so a card written in plain
  web CSS renders correctly by default.
- Lynx-specific property rewriting, for example `display: linear`, does not run.
- `:root` is not rewritten to the card's root element. Since a card renders
  inside a shadow root, where `:root` matches nothing, rules and custom
  properties declared under `:root` never reach the card; declare them on the
  root element's own class instead. This one fails silently, because a `var()`
  reading such a property is invalid at computed-value time and drops the whole
  declaration.

Tokenizing this CSS would require a CSS parser dependency in the decode worker.
