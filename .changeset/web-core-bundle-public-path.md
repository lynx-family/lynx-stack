---
"@lynx-js/web-core": patch
---

Preserve each fetched bundle's original URL while executing its decoded background and main-thread scripts so `output.publicPath: 'auto'` resolves assets relative to the bundle instead of Web Core's worker or blob URL.
