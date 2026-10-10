---
"@lynx-js/react": patch
"@lynx-js/react-umd": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add the `@lynx-js/react/worklet-runtime/init` entry and resolve it to the published, unbundled runtime module in normal and lazy builds. The entry uses the existing runtime initialization guard, so loading it again preserves the runtime and its registrations.

Existing compiler output continues to use the legacy runtime-loading path.
