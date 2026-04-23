---
"@lynx-js/web-elements": patch
---

fix: list cannot drag-scroll inside x-foldview-slot-ng

Cause: `touchstart` used `elementsFromPoint(pageX, pageY)` (expects `clientX/clientY`), so hit-testing can miss the real inner scroller (e.g. `x-list` shadow `#content`) when the document is scrolled.

Fix: use `elementsFromPoint(clientX, clientY)` + `event.composedPath()` for Shadow DOM, and keep `previousPageX` updated during `touchmove`.
