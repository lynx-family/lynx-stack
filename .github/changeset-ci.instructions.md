---
applyTo: ".github/workflows/test.yml,.github/workflows/deploy-main.yml,.github/scripts/check-*changeset*.cjs"
---

When validating changesets in CI, use `pnpm changeset status --since=origin/main --output <file>` and consume the JSON in a script for stable checks (for example, blocking `major` bumps) instead of parsing CLI text output.

When validating changeset Markdown files in CI, run `node .github/scripts/check-no-heading-changeset.cjs .changeset-status.json` so the script resolves files from `changeset status` output, and fail the job if any listed changeset file contains H1 (`#`), H2 (`##`) or H3 (`###`) headings.

Keep `privatePackages.version` enabled in `.changeset/config.json` so private package changesets are consumed by `pnpm changeset version`; leave `privatePackages.tag` disabled so private packages do not get release tags.

After CI runs `pnpm changeset version`, run `node .github/scripts/check-no-leftover-changesets.cjs` before any snapshot/canary rewrite or publish step. The check should fail if `.changeset/*.md` files remain, because leftover changesets usually mean Changesets skipped an ignored or non-versioned package.
