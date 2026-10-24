---
"@lynx-js/motion": patch
---

Compile Motion dependencies against private Lynx runtime imports instead of installing DOM and microtask polyfills on host globals.

Bundle upstream type declarations so upstream Motion packages are only needed as development dependencies.

Select private DOM and scheduling imports from a predefined Lynx runtime preset, including animation-frame scheduling with a timer fallback.
