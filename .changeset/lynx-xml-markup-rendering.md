---
"@lynx-js/web-core": minor
---

Support rendering buildless Lynx XML markup cards.

A `lynx-view` whose `url` points at a single file Lynx XML document (a versioned
`<lynx>` root wrapping `<style>`, `<script main-thread>` and
`<script background>` sections) is now loaded and rendered directly, with no
Rspeedy/ReactLynx build step. The format is detected by content sniffing, so no
`Content-Type` cooperation is needed from the server.

To let such cards drive their own lifecycle, this also adds:

- `lynx.getEngine()`, the main-thread Engine context proxy, which delivers the
  `__RenderPage`, `__UpdatePage`, `__DestroyLifetime` and `__UpdateGlobalProps`
  engine events. When a card subscribes to one of these, the event is dispatched
  instead of the corresponding `globalThis.renderPage`/`updatePage` call, so
  existing bundles that export those functions keep their current behavior.
- The `__AddEventListener` and `__RemoveEventListener` element PAPIs, which bind
  a main-thread function as an event listener (as opposed to `__AddEvent`, which
  binds a handler name for cross-thread dispatch).

Card teardown no longer requires a framework lifetime hook: cards that run their
own background script never install `tt.callDestroyLifetimeFun`, and the
resulting error previously prevented the card from being destroyed at all.

Known limitation: the CSS carried by `<style>` is passed to the style pipeline
verbatim rather than tokenized, so the `transform-vw`/`transform-vh`/
`transform-rem` attributes and Lynx-specific property rewriting (for example
`display: linear`) do not apply to XML markup cards. Browsers resolve `rem`,
`vh` and `calc()` natively, so cards written in plain web CSS are unaffected.

For the same reason `:root` is not rewritten to the page element, and a card is
rendered inside a shadow root where `:root` never matches, so rules and custom
properties declared under `:root` do not reach the card. Declare them on the
page's own selector (for example `.page`) instead.

Tokenizing this CSS would require a CSS parser dependency in the decode worker.
