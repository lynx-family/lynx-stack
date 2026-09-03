---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Add typed `MainThreadObject` handles whose target factory is defined by a Main Thread Function, with identity-preserving capture and hydration, runtime-owned reference release, and exact-type handle downcasting for readonly creation-payload access. V1 intentionally exposes no user-land disposal API. Applications can import the APIs from `@lynx-js/react` or `@lynx-js/react/main-thread-object`; production bundles that only use ordinary worklets or `MainThreadRef` retain the smaller core worklet runtime.
