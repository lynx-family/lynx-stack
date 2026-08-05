---
"@lynx-js/web-core": minor
---

Add the `__AddEventListener` and `__RemoveEventListener` element PAPIs.

These bind a main-thread _function_ as an event listener, as opposed to
`__AddEvent`, which binds a handler _name_ for cross-thread dispatch or a
worklet object for main-thread dispatch. Cards that build their UI directly from
the Element PAPIs need the callback form.

Callbacks are filed in the element's own handler table, the same one
`__AddEvent` writes to, so they take part in the engine's event dispatch rather
than in a second one: capture ordering, `catch` stopping propagation and
global-bind all behave as they do for handler names, and the two forms can stop
each other.

`capture`, `once` and `passive` are honored, `closure_type` and `bind_type`
select the binding semantics, and a `kClient` binding with a string handler is
filed as a cross-thread handler. `signal` is accepted for parity with the engine
PAPI, which also reads it as a boolean, and is otherwise ignored; remove a
listener with `__RemoveEventListener`. Several callbacks may be registered for
one element and event, as with `addEventListener`.
