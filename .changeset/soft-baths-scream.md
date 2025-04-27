---
"@lynx-js/web-elements": patch
---

fix: the scroll-x field of scroll-view needs to be handled correctly.

Before this, scroll-x of '' would result in no scrolling along x-axis.
