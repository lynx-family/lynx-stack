---
"@lynx-js/react": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Add `enableMTSRendering` to render entirely from the background thread.

With `pluginReactLynx({ enableMTSRendering: false })`, the main thread does not render the first screen: the first frame is empty and the whole UI is rendered by the background thread through hydration. The main-thread bundle no longer contains the user code — it only boots the ReactLynx runtime, followed by the per-module snapshot and worklet registrations that the build tool collects from every compiled module of the main-thread layer. The collection is independent of tree-shaking, so a component that is only rendered by the background thread (e.g. behind `__MAIN_THREAD__ ? null : <Counter />`) or comes from a `sideEffects: false` package still registers its snapshots, avoiding `Snapshot not found`.

`@lynx-js/react-rsbuild-plugin` requires `@lynx-js/react` `^0.124.0`.
