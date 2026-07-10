---
"@lynx-js/react": patch
---

Keep DevTools Lepus ID mapping wired to the shared snapshot instance manager, so production devtools builds can resolve native unique IDs without importing the full snapshot runtime into the main-thread bundle.
