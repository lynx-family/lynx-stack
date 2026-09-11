---
"@lynx-js/react": patch
---

Export `__page` from the Element Template internal entry, so a development build that imports `@lynx-js/preact-devtools` no longer fails with `export '__page' was not found in '@lynx-js/react/internal'`.
