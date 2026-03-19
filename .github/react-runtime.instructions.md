---
applyTo: "packages/react/runtime/**"
---

When updating runtime snapshot tests for preview preact builds that carry named children props like `$0` and slot-index semantics, keep `list` host snapshots isolated from surrounding `view`/`text` snapshots by creating a standalone `__SNAPSHOT__(<list>{HOLE}</list>)` and inserting it into the outer snapshot.
Do not drop `packages/react/runtime/__test__/list.test.jsx` cases added on `main`; preserve nested-list recording and `__DestroyLifetime` callback cleanup assertions while adapting expectations to the new snapshot structure.
