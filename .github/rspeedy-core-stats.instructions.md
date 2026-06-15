---
applyTo: "packages/rspeedy/core/**"
---

Treat Rspeedy's `performance.profile` as a Rspeedy-level compatibility feature rather than an Rsbuild `performance.profile` pass-through. When `performance.profile` is enabled, keep emitting `dist/stats.json` from Rspeedy core via a build hook so consumers still get a stats file on Rsbuild v2. The emitted JSON must pass explicit Rspack stats options for `assets`, `chunks`, `modules`, `entrypoints`, and `chunkGroups`; `stats.toJson({})` is not enough on Rspack v2. Do not normalize core's multi-compiler stats by selecting a child compilation, because that changes `stats.json` for every Rspeedy project. If RelativeCI needs only one compilation, select that child in the specific app or example config that owns the upload.
