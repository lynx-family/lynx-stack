---
"@lynx-js/react-refresh-webpack-plugin": patch
---

Resolve `ReactRefreshRspackPlugin.loader` when it is read instead of when the package is imported, so the package can be imported in the browser through `@rspack/browser`.
