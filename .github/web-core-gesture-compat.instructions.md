---
applyTo: "packages/web-platform/web-core/**"
---

Keep `__SetGestureDetector` and `__RemoveGestureDetector` available in both client and server Element PAPIs even while Lynx-for-Web gesture recognition is unsupported, so `main-thread:gesture` bundles degrade to no gesture instead of throwing during evaluation.
