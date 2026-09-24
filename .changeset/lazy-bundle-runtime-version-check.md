---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
---

Add `registerRuntimeVersion()` and `getRuntimeVersion()` to record the host's `@lynx-js/react` runtime version and report versions from standalone lazy bundles. The build stamps each bundle with `__RUNTIME_VERSION__`; bundles built by older plugins that do not stamp the version are unaffected.
