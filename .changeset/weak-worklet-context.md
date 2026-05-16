---
"@lynx-js/react": patch
---

Avoid retaining transformed nested worklet contexts after worklet transformation.

Nested worklets transformed by the worklet runtime now keep their context recovery metadata through a weak reference, preventing cached transformed worklet functions from keeping list-item worklet contexts alive.
