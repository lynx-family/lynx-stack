---
"@lynx-js/react": patch
---

Receive the app-level callbacks by subscription instead of by assigning handlers
onto the app object. The engine and lynx-core look those callbacks up on the app
by name, and that object is per card, so a runtime shared by a LynxGroup could
only ever serve whichever card assigned last.

Element events, card data, global props, reload and destroy now come from the
page's own context proxies; `__OnLifecycleEvent` uses lynx-core's replaying
subscription, because a card's first lifecycle event is dispatched before its
background bundle has finished evaluating, and falls back to the method on an
engine that does not offer it. Each page keeps its own handlers, and
`createRenderContext({ lynx })` registers against that page's app.
