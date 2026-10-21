# Background-function lifecycle cleanup

Reference tracking publishes its retained marker and count only after
`FinalizationRegistry.register` succeeds. A failed registration leaves the same
target eligible for retry and cannot create an untracked reference count.

Delayed replay drops the consumed queue rather than truncating its array.
PrimJS can keep truncated array storage alive, retaining completed tasks and
function handles after their external owners disappear. Dropping the queue lets
those targets be collected and their background executions released.

These cleanup rules do not establish ownership across Native dictionary cloning.
Native event descriptors still require a separate local-context ownership bridge.
