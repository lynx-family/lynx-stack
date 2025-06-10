---
"@lynx-js/react": patch
---

Fix a memory leak in ReactLynx where the C++ FiberElement is not released when removing the child from page.
