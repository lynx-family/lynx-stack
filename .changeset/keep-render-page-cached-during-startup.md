---
"@lynx-js/cache-events-webpack-plugin": patch
---

Keep main-thread `renderPage` calls cached until asynchronous entry startup finishes, even if ReactLynx registers its handler earlier. Flush the element tree after replay so the native first screen is committed without waiting for a background patch.
