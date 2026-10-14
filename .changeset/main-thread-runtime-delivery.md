---
"@lynx-js/react": minor
"@lynx-js/react-umd": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-alias-rsbuild-plugin": minor
"@lynx-js/react-refresh-webpack-plugin": patch
"@lynx-js/testing-environment": minor
---

Deliver the main-thread runtime through named imports from its init entry, including background-only definitions that carry their registration dependencies into the main-thread graph. Runtime code participates in business defines and release processing. Every supported transform supplies semantic runtime requirements, including for definitions injected from background-only modules; watch rebuilds refresh their dependencies and metadata.

Upgrade the build plugins and `@lynx-js/react` together. This release requires `@lynx-js/react@^0.128.0`; its runtime and bundled transform use the same module-delivery protocol. The refresh plugin adds support for `@lynx-js/react-webpack-plugin@^0.13.0` while retaining its existing supported versions. Older compiler output is unsupported. The prebuilt worklet-runtime chunk, its package entries, and `loadWorkletRuntime` are removed. Combined lazy chunks share their paired main runtime, and standalone lazy bundles bootstrap themselves.

The worklet init entry follows `worklet.runtimePkg`: remove a trailing `/internal`, if present, and append `/worklet-runtime/init`. Its `registerWorklet` export uses the existing host registration function when the runtime is already initialized. Default worklet options use `@lynx-js/react/internal` for helpers.

Testing-library initializes module-delivered worklets on its emulated main thread in Vitest and Rstest.
