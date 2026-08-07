---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/testing-environment": patch
---

Add `pluginReactLynx({ experimental_enableMTSRendering: false })`, which disables IFR (Instant First-Frame Rendering) to simplify the workflow for meta-framework that does not need the dual-thread concept.
