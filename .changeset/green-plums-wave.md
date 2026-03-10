---
"@lynx-js/react": patch
---

Avoid registering lifecycle refs for main-thread functions (MTF) that have not received an `execId` during `renderPage()` first-screen binding.
