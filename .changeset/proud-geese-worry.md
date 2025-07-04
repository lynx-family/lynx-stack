---
"@lynx-js/react": patch
---

Wrap the main thread `renderPage` in preact `act` to ensure that the effects are flushed.
