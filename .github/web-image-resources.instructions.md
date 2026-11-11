---
applyTo: "packages/web-platform/{web-elements,web-core}/**"
---

Resolve image sources and placeholders in `ImageSrc` through the image's current shadow-root host `resolveResource` hook. Keep the original element attributes unchanged, and resolve again on connection because detached elements may not yet have a host or may move between hosts. Apply the same hook to placeholder preloads and error fallbacks. Compare fallback URLs with the internal image's `src` attribute, not its absolute `src` property, to avoid repeatedly assigning a failed relative placeholder. Keep web-elements independent of web-core by using a structural host type.
