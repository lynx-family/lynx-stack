---
'@lynx-js/react-webpack-plugin': minor
'@lynx-js/react-rsbuild-plugin': patch
---

Support Main Thread Function HMR in native ReactLynx development builds. Apply main-thread updates through native bundle loading before releasing background Fast Refresh, and refresh worklet owners when their main-thread dependencies change. Reload once if either runtime fails or times out, and preserve runtime version coordination when the development connection reconnects.

Accept ordinary Snapshot component and helper updates at their actual main-thread entry roots, preserving explicit HMR handlers and declines. Keep a stable main-thread registration module so the first background-only worklet added during development is registered before Fast Refresh resumes.

Allow up to ten seconds for matching main-thread completion before timeout recovery.

Load background HMR updates through the same Native bundle adapter, preserve the SDK runtime wrapper in per-chunk sections, and retain the original background loader on hosts without Native app-scope initialization.

Use the build engine's exposed template plugin consistently for React compilation and Native HMR hooks, while retaining the installed template plugin as the default for direct Rspack integrations.
