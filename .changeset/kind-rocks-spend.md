---
"@lynx-js/react": patch
---

fix: main thread functions created during the initial render cannot correctly call `runOnBackground()` after hydration
