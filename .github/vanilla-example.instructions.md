---
applyTo: "examples/vanilla/**"
---

Create the page with `__CreatePage`, then append an `__CreateView` content container and put flex or linear layout styles on that container. On Web, the page root is a plain `div`, while Lynx-transformed flex custom properties are consumed by Lynx container elements; applying `flex-direction` directly to the page root can therefore fall back to a horizontal row.

Keep `src/counter.lynxml` self-contained: inline its CSS and both thread scripts, use Element PAPI and native `lynx` context APIs directly, and do not import JavaScript, stylesheets, runtime packages, or external resources.

Keep the TypeScript `main` entry and its thread scripts, event definitions, and stylesheet together under `src/main/`. Leave the independent LynXML entry and shared environment declarations in `src/`.
