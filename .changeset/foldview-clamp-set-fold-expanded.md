---
"@lynx-js/web-elements": patch
---

Clamp the `setFoldExpanded` offset of `<x-foldview-ng>` to the scrollable length.

`setFoldExpanded` called the native `scrollTo`, bypassing the clamping done by the
`scrollTop` setter. A page collapsing its header with a deliberately large offset
(e.g. `offset: '99999px'`) scrolled past the end, which does not happen on native.
