---
"@lynx-js/web-elements": patch
---

fix: allow the height of `x-foldview-slot-ng` + `x-foldview-toolbar-ng` > `x-foldview-ng`

Although this is not a correct usage, we're able to tolerant this situation.
