---
applyTo: "packages/testing-library/kitten-lynx/**/*"
---

When `KittenLynxView` attaches to a Lynx devtool session, do not assume `DOM.getDocument` is fully populated as soon as the session appears in `sendListSessionMessage`. Poll for a real document root child before caching `_root`, and throw a clear timeout error if the DOM never becomes ready.
