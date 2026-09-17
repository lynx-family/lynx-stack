---
"@lynx-js/react": patch
---

Preserve first-screen MainThreadRef values and delayed `runOnBackground` calls when a nested main-thread function's original context is garbage-collected before hydration. Hydration now reads the context already owned by the bound function without retaining the original context.
