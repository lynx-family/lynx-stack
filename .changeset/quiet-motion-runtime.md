---
"@lynx-js/motion": patch
---

Compile Motion dependencies against private Lynx runtime imports instead of installing DOM and microtask polyfills on host globals.

Bundle upstream type declarations so upstream Motion packages are only needed as development dependencies.
