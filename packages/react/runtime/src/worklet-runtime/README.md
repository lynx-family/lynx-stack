# Element Template worklet identity

Element Template can clone event descriptors into Native dictionaries. A callback
returned through that boundary can be a PrimJS wrapper rather than the ordinary
JavaScript object accepted by `FinalizationRegistry.register`.

Keep the local worklet context as the owner, as Snapshot does. Before Native
clones an ET event descriptor, assign a runtime-local `_runtimeCtxId` and record
the context in a weak lookup. `runWorklet` resolves copied descriptors to that
context before transforming captures, so the existing transformation registers
ordinary local callback objects instead of Native wrappers. The weak lookup does
not keep the context alive.

Track a prepared background input before calling Native. If Native rejects it,
collecting that input must still release its already-registered background
execution. Only Native success commits the slot's strong reference and hydration
handoff; committing does not register the context again. Removal drops the slot's
reference. Escaped callbacks follow the existing Snapshot capture and GC behavior.

Context identifiers use a card-lifetime counter independent of lifecycle manager
instances, so runtime initialization and entry re-evaluation do not reuse IDs.
Retire the previous manager to invalidate its lookup and stop old finalizers from
sending release events into the new runtime. Snapshot observers continue to track
references without preparing ET identities.

This integration keeps Snapshot's existing callback transformation, first-screen
hydration, and delayed-call replay semantics. It does not add per-binding callback
materialization, shared-capture isolation, or a new delayed queue representation.
Shared first-screen descriptor mutation and escaped-callback lifetime limitations
that also occur in Snapshot are outside this fix. Registration atomicity and
consumed-queue cleanup already on the base remain unchanged.
