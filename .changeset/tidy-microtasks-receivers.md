---
'@lynx-js/motion': patch
---

Preserve the native Lynx receiver in the microtask polyfills for Motion and Motion mini, preventing render updates from failing when consumers call the scheduler as a standalone function. Repair an existing unbound native alias while preserving other host schedulers and the Promise fallback.
