---
"@lynx-js/web-core": minor
---

Add `lynx.getEngine()`, the main-thread Engine context proxy.

This is the web counterpart of the engine's `kEngine` context proxy. A card
subscribes to it to receive the engine lifecycle events `__RenderPage`,
`__UpdatePage`, `__DestroyLifetime` and `__UpdateGlobalProps`, which is how a
card built directly from the Element PAPIs drives its own first paint, updates
and cleanup.

Listeners receive a plain `{ type, data }` object rather than a DOM event,
matching what the engine hands scripts. For `__RenderPage` and `__UpdatePage`,
`data` holds the call's positional arguments as an array.

Existing bundles are unaffected. Each of these events keeps the engine's own
fallback rule: if the card registered a listener the event is dispatched,
otherwise the corresponding `globalThis.renderPage` / `updatePage` call happens
exactly as before. Server-side rendering always reports no listener, so it stays
on the direct path.

Card teardown no longer requires a framework lifetime hook. A card that runs its
own background script never installs `tt.callDestroyLifetimeFun`, and the
resulting error previously propagated far enough to skip `destroyCard`, leaving
the card registered after its view was gone. The hook is now optional, while a
hook that exists and fails is still reported.
