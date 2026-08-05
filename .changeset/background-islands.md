---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add `pluginReactLynx({ experimental_backgroundIslands: true })`: every `<Background>` is folded to its `fallback` on the main-thread target — so the deferred subtree's module closure leaves the main-thread bundle and its element definitions are assembled there from the background compilation — while the main thread keeps compiling and rendering everything around the boundaries.

This is the same fold `enableMTSRendering: false` performs, without giving up main-thread rendering for the rest of the app. It also applies per boundary rather than per build, so a multi-entry build can defer in one entry without leaving another's first frame empty.
