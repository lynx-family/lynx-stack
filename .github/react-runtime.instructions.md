---
applyTo: "packages/react/runtime/**"
---

When updating runtime snapshot tests for preview preact builds that carry named children props like `$0` and slot-index semantics, keep `list` host snapshots isolated from surrounding `view`/`text` snapshots by creating a standalone `__SNAPSHOT__(<list>{HOLE}</list>)` and inserting it into the outer snapshot.
Do not drop `packages/react/runtime/__test__/list.test.jsx` cases added on `main`; preserve nested-list recording and `__DestroyLifetime` callback cleanup assertions while adapting expectations to the new snapshot structure.
For ReactLynx `Children`, reuse `preact/compat` behavior and derive types from `typeof PreactChildren`; only override `map`, `forEach`, and `toArray` to expose readonly frozen arrays.
When adding snapshot runtime tests that manually construct `SnapshotInstance` or `BackgroundSnapshotInstance`, remember that the managers' `clear()` methods intentionally do not reset `nextId`; use explicit ids or restore `nextId` in the test to avoid unrelated inline snapshot churn.
