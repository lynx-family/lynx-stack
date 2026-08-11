---
applyTo: "examples/vanilla/**"
---

Create the page with `__CreatePage`, then append an `__CreateView` content container and put flex or linear layout styles on that container. On Web, the page root is a plain `div`, while Lynx-transformed flex custom properties are consumed by Lynx container elements; applying `flex-direction` directly to the page root can therefore fall back to a horizontal row.
