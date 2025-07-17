---
"@lynx-js/web-elements": patch
---

fix: list may only render only one column in ReactLynx.

This is because `span-count` may not be specified when `list-type` is specified, resulting in layout according to `span-count="1"`. Postponing the acquisition of `span-count` until layoutListItem can solve this problem.
