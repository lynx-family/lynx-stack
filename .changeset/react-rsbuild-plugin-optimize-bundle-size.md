---
"@lynx-js/react-rsbuild-plugin": minor
---

feat: support `optimizeBundleSize` option to remove unused code for main-thread and background.

- If `optimizeBundleSize` is `true` or `optimizeBundleSize.background` is `true`, `lynx.registerDataProcessors` calls will be marked as pure for the background thread output.
- If `optimizeBundleSize` is `true` or `optimizeBundleSize.mainThread` is `true`, `NativeModules.call` and `lynx.getJSModule` calls will be marked as pure for the main-thread output.
