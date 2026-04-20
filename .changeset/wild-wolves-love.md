---
"@lynx-js/web-elements": patch
---

fix: list `bindscrolltolower` may not trigger because the lower threshold
sentinel had no effective size or offset, causing the bottom
`IntersectionObserver` to miss the list boundary
