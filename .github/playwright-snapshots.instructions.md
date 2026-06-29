---
applyTo: "packages/web-platform/**/tests/**/*"
---

When investigating Playwright snapshots for a failed CI shard, mirror the CI command's full selected project set and shard first. Playwright sharding is computed across all selected projects, so `--project=webkit --shard=N/M` can cover a different test set than CI's unfiltered `--shard=N/M`.

When committing snapshot updates from a browser-specific task, stage only the intended browser snapshots. Running `CI=1` enables retries, so avoid committing snapshots written by flaky retries or by unrelated browser projects from a full-shard `--update-snapshots` run.
