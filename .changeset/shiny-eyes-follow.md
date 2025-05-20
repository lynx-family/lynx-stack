---
"@lynx-js/web-elements": patch
---

fix: x-list should observe property list-type change.

Before this commit, list-type only works when it was first assigned.

use `requestAnimationFrame` instead of `queueMicrotask` to layoutListItem, this is because it may cause crashes in webkit.
