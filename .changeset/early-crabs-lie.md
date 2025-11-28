---
"@lynx-js/react": patch
---

Fixed blank screen issues with nested lists. Lazily created nested lists were being flushed but not properly recorded, causing rendering failures.
