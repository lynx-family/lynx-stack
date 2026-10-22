---
"@lynx-js/react": patch
---

Preserve background callback ownership in main-thread worklets. Isolate shared first-screen captures during hydration and keep callbacks alive until their bindings and escaped callers are collected.
