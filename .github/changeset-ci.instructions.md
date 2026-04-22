---
applyTo: ".github/workflows/test.yml"
---

When validating changesets in CI, use `pnpm changeset status --since=origin/main --output <file>` and consume the JSON in a script for stable checks (for example, blocking `major` bumps) instead of parsing CLI text output.

When validating changeset Markdown files in CI, run `node .github/scripts/check-no-heading-changeset.cjs .changeset-status.json` so the script resolves files from `changeset status` output, and fail the job if any listed changeset file contains H1 (`#`), H2 (`##`) or H3 (`###`) headings.
