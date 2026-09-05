---
"@lynx-js/lynx-bundle-rslib-config": patch
---

Wrap the main-thread assets of an external bundle by their `lynx:main-thread` mark instead of a filename pattern derived from the entry name, so an entry named like a path (`./App.js`) keeps its wrapper and no longer fails with `module is not defined`.
