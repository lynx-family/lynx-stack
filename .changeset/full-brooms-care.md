---
"@lynx-js/react": minor
---

**BREAKING CHANGE**: Delay the `createSnapshot` operation to `Snapshot` constructor to speed up IFR.

This change refactors how snapshots are created and registered:
- Removed the `entryUniqID` function
- Snapshots are now lazily created via `snapshotCreatorMap` instead of eagerly at bundle load time
- Snapshot IDs are generated at compile time and only prefixed with `${globDynamicComponentEntry}:` for standalone lazy bundles

**⚠️ Lazy Bundle Compatibility:**
- **Backward compatibility (new runtime → old lazy bundles)**: ✅ **Supported**. Old lazy bundles will work with the new runtime, but will lose their entryName prefix (e.g., `https://xxx/lynx.bundle:__snapshot_xxx` becomes `__snapshot_xxx`). This should not break functionality since snapshot IDs use `filename_hash`, `content_hash`, and `snapshot_counter` for uniqueness.
  
- **Forward compatibility (old runtime → new lazy bundles)**: ❌ **NOT Supported**. Lower version consumers **will not be able to load lazy bundles produced by this version** due to the changed snapshot creation mechanism.

**Migration guidance**: 
If you are using lazy bundles, ensure all consumers are upgraded to this version or later **before** deploying lazy bundles built with this version. For monorepo setups, coordinate the upgrade across all consuming applications.

