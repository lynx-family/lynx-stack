---
"@lynx-js/react": patch
---

Keep ordinary Main Thread Function member captures working with older externalized ReactLynx runtimes that do not export `captureMainThreadObject`. MainThreadObject usage still requires a runtime that supports it.
