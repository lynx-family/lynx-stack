---
"@lynx-js/react": patch
---

Provide `getUniqueIdListBySnapshotId` and `getSnapshotIdByUniqueId` on the Element Template main thread when devtools are enabled, so `@lynx-js/preact-devtools` no longer fails with `getUniqueIdListBySnapshotId is not a function`.
