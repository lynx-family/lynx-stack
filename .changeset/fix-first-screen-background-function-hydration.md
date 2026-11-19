---
"@lynx-js/react": patch
---

Keep first-screen `runOnBackground` handles usable across hydration, rerenders, and main-thread garbage collection by transitioning queued handles out of first-screen mode and retaining their background execution lifecycle until collected.
