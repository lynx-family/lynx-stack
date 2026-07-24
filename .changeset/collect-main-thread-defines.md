---
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react": minor
"@lynx-js/react-refresh-webpack-plugin": patch
---

feat(react): add `enableMTSRendering` to render the first screen from the background thread

With `enableMTSRendering: false` the main thread renders nothing on first screen and the background thread hydrates. Each main-thread module is reduced to its snapshot and worklet registrations (business logic is stripped), except the ReactLynx runtime and its dependency closure, so the main-thread bundle carries only what the registrations need.
