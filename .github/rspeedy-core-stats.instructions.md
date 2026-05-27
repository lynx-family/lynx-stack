---
applyTo: "packages/rspeedy/core/**"
---

Treat Rspeedy's `performance.profile` as a Rspeedy-level compatibility feature rather than an Rsbuild `performance.profile` pass-through. When `performance.profile` is enabled, keep emitting `dist/stats.json` from Rspeedy core via a build hook so bundle-analysis and RelativeCI workflows continue to work on Rsbuild v2 without requiring every consumer config to add its own stats plugin.
