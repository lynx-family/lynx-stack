---
"@lynx-js/web-elements": patch
---

fix: improve x-foldview-ng

- support fling for touch event driven scrolling
- allow the height of `x-foldview-slot-ng` + `x-foldview-toolbar-ng` > `x-foldview-ng`
- do not prevent horizontal gesture. After this commit we only allow one direction gesture for one touch (start -> end)
