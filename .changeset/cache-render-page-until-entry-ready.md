---
"@lynx-js/cache-events-webpack-plugin": patch
---

Keep main-thread `renderPage` calls cached until asynchronous entry startup finishes, even when ReactLynx registers the real handler earlier. This prevents an empty first-screen handover and hydration patches referencing snapshots from component externals that have not finished loading.
