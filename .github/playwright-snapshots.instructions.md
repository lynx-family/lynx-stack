---
applyTo: "packages/web-platform/**/tests/**/*"
---

When updating Playwright snapshots for a failed CI shard, mirror the CI command's full selected project set and shard first. Playwright sharding is computed across all selected projects, so `--project=webkit --shard=N/M` can cover a different test set than CI's unfiltered `--shard=N/M`; use project-filtered reruns only as targeted follow-up verification.
