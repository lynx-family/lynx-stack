---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add `pluginReactLynx({ experimental_backgroundOnlyAssembly: true })`, which implements component-level `'background only'` on the main-thread-defines assembly infrastructure: a `'background only'` module compiles as a main-thread stub shell (exports survive as inert empty functions) and its snapshot/worklet definitions are collected while compiling the background and assembled into the main-thread chunk. Note that under this option the top-level statements of a `'background only'` module no longer run on the main thread; the build warns when such statements are dropped.
