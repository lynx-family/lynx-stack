---
"@lynx-js/react": patch
---

Avoid retaining transformed nested worklet contexts through a strong `.ctx` reference.

Nested worklets transformed by the worklet runtime now store the original worklet context through `ctxRef` instead of a strong `ctx` property, preventing cached transformed worklet functions from keeping list-item worklet contexts alive. Hydration still falls back to the legacy `.ctx` shape for compatibility.
