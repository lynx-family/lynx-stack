---
applyTo: "packages/rspeedy/core/**"
---

Treat Rspeedy's `performance.profile` as a Rspeedy-level compatibility feature rather than an Rsbuild `performance.profile` pass-through. When `performance.profile` is enabled, keep emitting `dist/stats.json` from Rspeedy core via a build hook so bundle-analysis and RelativeCI workflows continue to work on Rsbuild v2 without requiring every consumer config to add its own stats plugin. The emitted JSON must pass explicit Rspack stats options for `assets`, `chunks`, `modules`, `entrypoints`, and `chunkGroups`; `stats.toJson({})` is not enough on Rspack v2. If Rspack returns a multi-compiler stats object, normalize it before writing by selecting the bundle-analysis compilation as top-level JSON; RelativeCI rejects a file whose useful stats fields only exist under `children`.
