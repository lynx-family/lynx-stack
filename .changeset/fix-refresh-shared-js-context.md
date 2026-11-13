---
"@lynx-js/react": patch
"@lynx-js/react-umd": patch
"@lynx-js/react-refresh-webpack-plugin": patch
---

Isolate Fast Refresh component registries per template bundle while scoping VNode tracking to each `@lynx-js/react/refresh` runtime instance so multiple templates sharing a JS context (`shareJsContext`) update independently.
