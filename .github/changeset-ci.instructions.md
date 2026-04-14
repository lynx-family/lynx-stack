---
applyTo: ".github/workflows/test.yml"
---

When validating changesets in CI, use `pnpm changeset status --since=origin/main --output <file>` and consume the JSON in a script for stable checks (for example, blocking `major` bumps) instead of parsing CLI text output.
