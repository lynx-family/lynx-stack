---
"@lynx-js/web-elements": patch
---

fix: remove the style `contain: content` of x-foldview-ng, otherwise it will cause the `position: fixed` elements to be positioned incorrectly after scrolling.
