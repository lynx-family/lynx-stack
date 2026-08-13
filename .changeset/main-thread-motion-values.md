---
"@lynx-js/react": patch
"@lynx-js/motion": patch
---

Add typed `MainThreadObject` handles whose lifecycle is defined by Main Thread Functions, so main-thread implementations are omitted from background bundles, and expose Motion values that hydrate to real `MotionValue` objects.
