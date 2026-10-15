---
'@lynx-js/react-webpack-plugin': minor
---

Support Main Thread Function HMR in native ReactLynx development builds. Apply main-thread updates through native bundle loading before releasing background Fast Refresh, and refresh worklet owners when their main-thread dependencies change. Reload once if either runtime fails or times out, and preserve runtime version coordination when the development connection reconnects.
