---
"@lynx-js/web-core": patch
---

Fix `__FlushElementTree()` - and every other Element PAPI - throwing when called
from inside a main-thread event handler.

The documented mutate-then-flush pattern threw `recursive use of an object
detected which would lead to unsafe aliasing in rust` on every event. Element
writes still landed, because the host applies each eagerly, but the throw
unwound through web-core's own dispatcher frames rather than the handler's: it
surfaced as an uncaught page error the application could not catch, and every
handler ordered after the flush - the rest of the bubble pass, the global-bind
pass - was skipped. A handler bound to a per-frame event produced hundreds of
errors in seconds.

`wasm-bindgen` wraps an exported struct in a borrow guard and holds a borrow for
the whole exported call, shared for `&self` and exclusive for `&mut self`.
Dispatch re-enters JS while `common_event_handler` is on the stack, so any
`&mut self` method the handler reached - `take_timing_flags` for
`__FlushElementTree`, and also `__AddEvent`, `__AddEventListener`,
`__SetDataset`, `__SetCSSId`, `__CreateElement` - failed that guard. Every
export on `MainThreadWasmContext` now takes `&self` and reaches its mutable
state through interior mutability, and the dispatcher reads an element's
handlers and dataset out of its cell before running any of them, so a handler
can also write to the element it is dispatching on.
