---
"@lynx-js/web-core": patch
---

Express positional event payloads and the `boundingClientRect` UI method in coordinates relative to the host `<lynx-view>`'s top-left, matching native Lynx semantics. Previously the values were viewport-relative, which only worked when the lynx-view sat at viewport origin.

The lynx-view's rect is cached by a new `BoundingClientRectService` (one per `LynxViewInstance`). The cache is invalidated at most once per `requestAnimationFrame`, which picks up CSS `transform`s on the lynx-view that `ResizeObserver` would not catch, while bounding the cost when many events read the rect in a tight loop and avoiding event-modification feedback loops.

Affected surfaces:

- `layoutchange.detail.{top,left,right,bottom}`
- `touch*` event `detail.{x,y}` and the per-touch `clientX`/`clientY`/`pageX`/`pageY` inside `touches`/`targetTouches`/`changedTouches`
- `mouse*` event `{x,y,clientX,clientY,pageX,pageY}` and `click.detail.{x,y}`
- The `boundingClientRect` UI method (`SelectorQuery#fields({rect: true})`, `NodesRef.invoke('boundingClientRect')`)
