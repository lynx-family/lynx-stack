---
"@lynx-js/web-core": minor
---

Add the `__AddEventListener` and `__RemoveEventListener` element PAPIs.

These bind a main-thread _function_ as an event listener, as opposed to
`__AddEvent`, which binds a handler _name_ for cross-thread dispatch or a
worklet object for main-thread dispatch. Cards that build their UI directly from
the Element PAPIs need the callback form.

`capture`, `once` and `passive` are honored, `closure_type` and `bind_type`
select the binding semantics, and a `kClient` binding with a string handler is
routed to `__AddEvent`. `signal` is accepted for signature parity but not
implemented; use `__RemoveEventListener`. Listeners registered this way are
detached on teardown, so a card that does not clean up after itself cannot leave
closures attached to elements that outlive the `lynx-view`.
