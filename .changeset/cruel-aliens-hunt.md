---
"@lynx-js/web-core": patch
---

feat: remove extra div #lynx-view-root

In this commit we've re-implemented the lynx-view's auto-size. Now we use the `contain:content` instead of `resizeObserver`.
