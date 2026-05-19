---
"@lynx-js/react": patch
---

Disable vnode reuse of different slot index in preact's diff, fixing a bug that `__RemoveElement` was called with mismatched parent and child element.
