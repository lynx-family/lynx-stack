# Element Template worklet identity

Element Template Native storage must preserve the original JavaScript worklet
context in declared main-thread event slots, as Snapshot does. Native may snapshot
the event wrapper and ordinary attribute data, but it must retain the wrapper's
`value` as a live MTS object. Background element preparation must exclude live
event and gesture values from both its task input and prepared result.

`runWorklet` transforms the context delivered by Native directly. The original
context and its captured callback objects remain ordinary JavaScript objects
accepted by `FinalizationRegistry.register`; no context identifier or reverse
lookup is needed. This runtime requires the corresponding Native storage behavior.
Older ET Native implementations that deep-copy worklet contexts are unsupported by
this integration.

Track a background input before calling Native. If Native rejects it, collecting
that input must still release its already-registered background execution. Only
Native success commits the slot's strong reference and hydration handoff;
committing does not register the context again. Removal drops the slot's reference.
Escaped callbacks follow the existing Snapshot capture and GC behavior.

Retire the previous lifecycle manager to stop old finalizers from sending release
events into the new runtime. Native event ingress must reject detached old
bindings so they cannot dispatch into a replacement runtime; `runWorklet` does not
reject contexts based on the lifecycle manager that originally retained them.
Snapshot observers continue to track references through the same lifecycle manager.

This integration keeps Snapshot's existing callback transformation, first-screen
hydration, and delayed-call replay semantics. It does not add per-binding callback
materialization, shared-capture isolation, or a new delayed queue representation.
Shared first-screen context mutation and escaped-callback lifetime limitations
that also occur in Snapshot remain unchanged. Registration atomicity and
consumed-queue cleanup remain unchanged.
