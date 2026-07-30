---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
---

Support `runtime: 'shared'` imports inside main-thread functions under `enableMTSRendering: false`. The collected worklet definitions now look shared modules up through a runtime registry, and each shared module compiles into the main-thread layer behind a registering wrapper — one live instance per thread, instead of a build error.
