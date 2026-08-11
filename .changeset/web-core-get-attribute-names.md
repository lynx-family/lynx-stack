---
"@lynx-js/testing-environment": patch
"@lynx-js/web-core": patch
---

Support the `__GetAttributeNames` element PAPI.

`ElementNode.getAttributeNames()` of the ReactLynx worklet runtime calls it, so a
main-thread script reaching that API threw `ReferenceError` on web.
