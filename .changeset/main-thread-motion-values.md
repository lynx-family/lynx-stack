---
"@lynx-js/react": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Add typed `MainThreadObject` handles whose lifecycle is defined by Main Thread Functions, with identity-preserving capture and hydration and type-scoped initial-payload inspection. Applications can import the APIs from `@lynx-js/react` or `@lynx-js/react/main-thread-object`; production bundles that only use ordinary worklets or `MainThreadRef` retain the smaller core worklet runtime.
