---
"@lynx-js/web-core": minor
---

Implement `lynx.addFont(fontFace, callback)` on web. The font is registered via the standard `FontFace` API against the lynx-view's owner document (`document.fonts` isn't scoped per shadow root, and that's also the document the rendered elements resolve fonts against), and `callback` fires once the font has finished loading. Registering the same font twice against a document — which is what a `lynx.reload()` re-running the card's `lynx.addFont()` calls amounts to — reuses the existing `FontFace` instead of appending another one.
