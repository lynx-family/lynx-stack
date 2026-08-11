---
'@lynx-js/react': patch
---

Fix an orphan `DEV_ONLY_SetSnapshotEntryName` when a lazy bundle is loaded during first-screen direct render.

`DEV_ONLY_AddSnapshot` is emitted from the `snapshotCreatorMap` `Proxy` set trap (at chunk evaluation time), while `DEV_ONLY_SetSnapshotEntryName` is emitted from inside `createSnapshot()` (at render time). Since snapshots became lazily created, those two moments sit on opposite sides of hydration: a lazy bundle loaded during first-screen direct render evaluates its chunk while `__globalSnapshotPatch` does not exist yet — so `DEV_ONLY_AddSnapshot` is skipped — but its `createSnapshot()` call happens after hydration and still emitted `DEV_ONLY_SetSnapshotEntryName`.

The main thread then rewrote the creator compiled into its *own* chunk (rather than the one serialized over from the background thread), which does not round-trip through `Function.prototype.toString`. `evaluate()` threw `SyntaxError`, aborting the whole patch loop and cascading into `snapshotPatchApply failed: ctx not found`.

The background thread now tracks which creators it actually sent and only emits `DEV_ONLY_SetSnapshotEntryName` for those, and the main thread guards on the `globDynamicComponentEntry` placeholder still being present and no longer lets this DEV-only HMR step abort patch application.
