---
applyTo: "{.github/workflows/**,.github/scripts/**}"
---

When validating changesets in CI, use `pnpm changeset status --since=origin/main --output <file>` and consume the JSON in a script for stable checks (for example, blocking `major` bumps) instead of parsing CLI text output.

When validating changeset Markdown files in CI, run `node .github/scripts/check-no-heading-changeset.cjs .changeset-status.json` so the script resolves files from `changeset status` output, and fail the job if any listed changeset file contains H1 (`#`), H2 (`##`) or H3 (`###`) headings.

When running `changeset status --since=origin/<base>` after `actions/checkout` with shallow history in pull request workflows, fetch and iteratively deepen both the base branch ref and the current pull request merge ref. Deepening only `origin/<base>` can leave `HEAD` shallow and make `git merge-base origin/<base> HEAD` fail even after repeated fetches.

When a GitHub Actions job uses `actions/checkout` and later runs any command that finds a merge base, including `git merge-base` or `changeset status --since=<ref>`, run `git config --local maintenance.auto false` after checkout and before the first merge-base lookup to avoid checkout-triggered local Git maintenance interfering with shallow-history refs.

Changesets CLI v3 requires `changesets/action@v2`. For trusted publishing, compose the `select-mode`, `version`, `pack`, and `publish` sub-actions so publishing uses the tarballs produced by the pack step. Pass the token through the `version` and `publish` actions' `github-token` input even when `GITHUB_TOKEN` is also present in the environment for a changelog plugin.

`changeset version` exits with status 1 when there are no unreleased changesets. Only preserve the old no-op behavior in workflows where an empty release is explicitly valid, and do not mask other versioning failures.

Changesets v3 gives dependents a `patch` bump when an internal peer dependency moves outside their declared range. Major-release checks should inspect the final `releases` array without assuming the v2 peer-dependent major cascade.
