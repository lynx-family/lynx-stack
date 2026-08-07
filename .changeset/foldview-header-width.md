---
"@lynx-js/web-elements": patch
---

Give `<x-foldview-header-ng>` a `width: 100%`.

The element is laid out with `position: absolute` but had no width, so it shrank to
fit its content instead of filling the foldview.
