---
'@lynx-js/web-core': minor
---

Correct mouse, tap, and touch-point `pageX`/`pageY` to use LynxView-relative coordinates, matching native Lynx and the `boundingClientRect` UI method. Previously these fields used browser document coordinates, so offset or scrolled embeds returned different values from native Lynx. `clientX`/`clientY` remain viewport-relative. Existing Web `x`/`y` aliases retain their view-relative behavior for compatibility. Consumers that need browser document coordinates can add the document scroll offset to `clientX`/`clientY` in their embedding host.
