---
"@lynx-js/react": patch
"@lynx-js/react-umd": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add the source-level `@lynx-js/react/worklet-runtime/init` entry and resolve it to runtime source in normal and lazy builds. Initialization preserves an existing host runtime and fills missing selector APIs without replacing its registrations.

Existing compiler output continues to use the legacy runtime-loading path.
