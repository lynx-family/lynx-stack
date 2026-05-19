---
"@lynx-js/web-core": patch
---

Add lynx-view-relative coordinates to positional event payloads (matching native Lynx semantics) while preserving viewport/document coordinates for Web interop, and switch the `boundingClientRect` UI method to lynx-view-relative.

The lynx-view's rect is cached by a new `BoundingClientRectService` (one per `LynxViewInstance`). The cache is invalidated by `transitionend`/`animationend` on the lynx-view itself (filtered to ignore descendants bubbling through) and by an idle-callback path throttled to at most one invalidation per 240 ms. This picks up CSS `transform`s and similar drifts that `ResizeObserver` would not catch, while bounding the cost when many events read the rect in a tight loop and avoiding event-modification feedback loops.

Coordinate model:

- `x`/`y` (top-level on `mouse*`; `detail.x`/`detail.y` on `click`/`touch*`; per-touch on `touches`/`targetTouches`/`changedTouches`) — lynx-view-relative (Lynx parity).
- `clientX`/`clientY`, `pageX`/`pageY` (top-level on `mouse*`/`click`; per-touch alongside the added `x`/`y`) — viewport- and document-relative, unchanged from the underlying DOM event (Web interop).
- `layoutchange.detail.{top,left,right,bottom}` is lynx-view-relative.
- The `boundingClientRect` UI method (`SelectorQuery#fields({rect: true})`, `NodesRef.invoke('boundingClientRect')`) returns lynx-view-relative coordinates.
