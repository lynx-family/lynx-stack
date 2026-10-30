---
'@lynx-js/web-core': patch
---

Subtract the lynx-view top-left offset from mouse event clientX/clientY, matching the normalization already applied to x/y. Preserve pageX/pageY as document coordinates.
