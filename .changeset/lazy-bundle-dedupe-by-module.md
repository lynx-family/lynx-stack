---
"@lynx-js/template-webpack-plugin": minor
---

Deduplicate lazy bundles: the same file imported via different paths (relative or alias) now produces a single bundle.

Async chunk groups are grouped by the resolved module of their dynamic imports instead of the chunk name derived from the raw import request, so `./Foo.jsx`, `../Foo.jsx` and `@/Foo.jsx` all load the same `async/src/Foo.jsx.[fullhash].bundle`, and a request that resolves above the compiler context no longer escapes the `async/` directory.
