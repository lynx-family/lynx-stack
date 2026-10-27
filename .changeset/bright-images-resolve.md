---
'@lynx-js/web-core': patch
'@lynx-js/web-elements': patch
---

Add the optional `lynx-view.resolveResource` hook to resolve image sources and placeholders before loading, including placeholder preloads, error fallbacks, and reconnection. Keep the original image attributes unchanged and prevent repeated fallback loads for relative placeholder URLs.
