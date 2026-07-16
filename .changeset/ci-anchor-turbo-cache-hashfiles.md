---

---

ci: anchor the TurboCache `hashFiles` glob to the repo-root `packages/` tree

The consumer workflows (test, rust, bundle-analysis, website, bench) keyed the
turbo cache on `hashFiles('**/packages/**/src/**/*.rs')`. The leading `**/`
matches `packages/` at any depth, so after `pnpm install` the glob walks into
every `node_modules`, which deterministically exceeds GitHub's 120s expression
limit on Windows runners (`Vitest (Windows)` failing with "hashFiles(...)
couldn't finish within 120 seconds"). It was also inconsistent with the job
that _saves_ the cache (`workflow-build.yml`), which already uses the anchored
`hashFiles('packages/**/src/**/*.rs')`.

Aligning all consumers to the anchored form fixes the Windows timeout and
removes a latent cache-key mismatch. No package changes — empty changeset.
