---
"@lynx-js/web-elements": patch
---

Add crossorigin attribute support to x-image component

- Added `crossorigin` to the `observedAttributes` array in `ImageSrc.ts`
- Implemented `#handleCrossorigin` handler using the `bindToAttribute` helper to forward the crossorigin attribute from the custom element to the internal `<img>` element
- Added comprehensive test coverage to verify the attribute is properly passed through to the shadow DOM

This enables CORS-enabled image loading when using `<x-image crossorigin="anonymous">` or similar configurations.
