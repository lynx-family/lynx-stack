---
"@lynx-js/chunk-loading-webpack-plugin": patch
---

Keep an installed chunk's module instances on the chunk object rather than in
the loading page's module cache. A loader that hands the same chunk object to
several pages now gives them one instance of each of that chunk's modules; a
loader that returns a fresh object per page keeps the previous behavior.
