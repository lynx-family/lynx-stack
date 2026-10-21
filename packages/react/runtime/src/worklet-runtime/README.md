# Main-thread worklet ownership

Native worklet descriptors are transport data. Element Template can copy their
nested values into Native dictionaries, so the identity or collection of a
PrimJS wrapper is not the identity or lifetime of a JavaScript callback handle.

Before Native clones an ET event descriptor, identity preparation assigns a
runtime-local `_runtimeCtxId` and records its local context in a weak index.
Reference tracking also registers that prepared input once, so collecting an input
rejected by Native still releases its background execution. Only Native success
commits the slot's strong reference and hydration handoff; committing does not
register the context again. The weak index does not keep the context alive.
Snapshot observers only track references; they do not prepare ET lookup identities.
Context identifiers are not reused when the worklet runtime restarts.
Descriptors from retired contexts must not acquire a new owner during delivery.
ET reload/destroy retires the previous manager so queued cleanup cannot release a
new background execution that reuses the same numeric ID.

Worklet transformation materializes background-function descriptors into ordinary
JavaScript handles and installs those handles in the captured context. Repeated
captures in one background execution share a handle. Before hydration, each local
context owns its own handles and captured containers so reusing one worklet for
multiple bindings cannot retarget an escaped callback during another binding's
hydration. The lifecycle manager only registers these local targets; registration
succeeds before bookkeeping becomes visible. Neither a temporary clone used only for registration nor a strong
canonicalization table can represent the ownership contract.

A live binding retains its local context, and an escaped function retains its
captured handles. First-screen handles remain local while calls are delayed;
hydration associates materialized handles with the background execution before
releasing the old binding, including handles held by escaped functions that have
not called `runOnBackground` yet. Unmaterialized first-screen descriptors remain
read-only and are never registered as owners. With no lifecycle manager,
transformation and hydration still prepare `_execId` metadata without GC tracking.
Removing a binding only drops that owner's reference. Background
execution state is released after every registered local owner has been collected.

Delayed replay drops the consumed queue rather than truncating its array, so
PrimJS cannot retain completed tasks and handles through unused array storage.
