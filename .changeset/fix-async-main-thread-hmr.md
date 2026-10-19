---
'@lynx-js/react-webpack-plugin': patch
'@lynx-js/webpack-dev-transport': patch
'@lynx-js/chunk-loading-webpack-plugin': patch
'@lynx-js/webpack-runtime-globals': minor
---

Apply main-thread hot updates to loaded async chunks, keep async definition modules stable when worklets are added or removed, and retain background HMR on hosts without Native bundle loading. Centralize the shared HMR runtime identifiers.
