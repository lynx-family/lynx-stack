---
applyTo: "{.github/workflows/**,.github/scripts/**}"
---

CI works from two release plans, because the checks ask two different questions.

`pnpm changeset status --since=origin/main --output <file>` answers what the pull request itself introduces. Use it for checks about the branch: blocking `major` bumps, validating the Markdown of the changesets it adds, and pairing dependency changes with a changeset. It also fails when a change has no changeset at all, and that detection is what needs a Git ref — without `--since` it falls back to `config.baseBranch` as a local ref, which a detached pull request checkout may not have.

`pnpm changeset status --output <file>` without `--since` answers what the next release publishes, because it assembles the plan from every changeset in `.changeset`. Use it for checks about the released versions, such as the peer dependency range check. It resolves `config.baseBranch` as a local Git ref, which a detached pull request checkout does not have, so point one at the base first with `git branch -f main origin/main`.

Do not answer the second question with the first plan. `--since` scopes it to the changesets added since the ref, so a package another branch already queued for a release is planned at its current version rather than the one it will be published at, and a range check reads violations the release does not have. Do not answer the first question with the second plan either: it carries the changesets of every merged branch, so a pull request would be blocked by a `major` it did not introduce.

When validating changeset Markdown files in CI, run `node .github/scripts/check-no-heading-changeset.cjs .changeset-status.json` so the script resolves files from the pull request's own changesets, and fail the job if any listed changeset file contains H1 (`#`), H2 (`##`) or H3 (`###`) headings.

When running `changeset status --since=origin/<base>` after `actions/checkout` with shallow history in pull request workflows, fetch and iteratively deepen both the base branch ref and the current pull request merge ref. Deepening only `origin/<base>` can leave `HEAD` shallow and make `git merge-base origin/<base> HEAD` fail even after repeated fetches.

When a GitHub Actions job uses `actions/checkout` and later runs any command that finds a merge base, including `git merge-base` or `changeset status --since=<ref>`, run `git config --local maintenance.auto false` after checkout and before the first merge-base lookup to avoid checkout-triggered local Git maintenance interfering with shallow-history refs.

Changesets CLI v3 requires `changesets/action@v2`. For trusted publishing, compose the `select-mode`, `version`, `pack`, and `publish` sub-actions so publishing uses the tarballs produced by the pack step. Pass the token through the `version` and `publish` actions' `github-token` input even when `GITHUB_TOKEN` is also present in the environment for a changelog plugin.

`changeset version` exits with status 1 when there are no unreleased changesets. Only preserve the old no-op behavior in workflows where an empty release is explicitly valid, and do not mask other versioning failures.

Changesets v3 gives dependents a `patch` bump when an internal peer dependency moves outside their declared range. Major-release checks should inspect the final `releases` array without assuming the v2 peer-dependent major cascade.

For each planned internal package release, validate that every publishable workspace package's normal semver `peerDependencies` range includes the planned `newVersion`. Treat `workspace:` peer ranges as explicitly pnpm-managed, and pair this range check with the dependency-changeset check so manual range changes are included in a release. Do not automatically widen peer ranges because keeping or dropping compatibility is a package-specific decision.
