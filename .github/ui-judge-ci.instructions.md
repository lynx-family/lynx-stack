---
applyTo: ".github/workflows/test.yml,.github/workflows/workflow-test.yml,.github/scripts/*ui-judge*.mjs,.github/ui-judge*.instructions.md,.github/actions/ui-judge-comment/**"
---

When wiring `@lynx-js/ui-judge` into pull request CI, preserve the PR comment even when the model-backed test fails, but do not hide the failed test. Prefer running UI Judge through the reusable `workflow-test.yml` job with `is-web: true`, uploading `ui-judge-results.json` as an artifact, and posting the comment from a separate thin job with `issues: write` and `pull-requests: write`.

Keep long UI Judge work inside a job with a bounded timeout, and write a fallback `ui-judge-results.json` before artifact upload when build or test execution fails. If UI Judge setup is ever split back into custom steps outside the reusable workflow, use step-level `timeout-minutes` on long setup, build, and model execution steps so the fallback result writer and PR comment action still run.

Keep the UI Judge Playwright job dependent on the repository `build` job, matching the `playwright-web-elements` dependency shape. Restore the same strict `.turbo` cache key with `fail-on-cache-miss: true`, but do not repeat a broad full-repository build in the Playwright container; pass focused `pnpm turbo build` commands through the reusable workflow's build command input for the UI Judge package and the A2UI playground prerequisites that the test actually consumes.

Use the upstream build job's restored turbo cache in UI Judge CI. Do not call package scripts directly with `pnpm --filter <package> build`, and do not pass `--force`; the focused turbo commands should replay the upstream build outputs from cache.

In UI Judge preflight code, do not depend on local `.git` metadata inside the custom Playwright container. The checkout can be available as files while `git diff` is unusable there, so use the pull request files API for changed-file gating and fail open by running UI Judge if the file list cannot be fetched.

Raise the soft open-file limit before running UI Judge Playwright tests in the Playwright container. The A2UI playground dev server uses rsbuild/chokidar watchers, so mirror the web-elements Playwright pattern with `ulimit -Sn 655350` before invoking `pnpm --filter @lynx-js/ui-judge test`.

Inject the full Midscene/OpenAI model environment into the UI Judge execution step, including `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_FAMILY`, `MIDSCENE_MODEL_NAME`, and `MIDSCENE_OPENAI_INIT_CONFIG_JSON`.

When rendering the UI Judge PR comment, include `GITHUB_RUN_ATTEMPT` in the workflow footer/link. GitHub reruns keep the same `GITHUB_RUN_ID`, so relying only on the run URL can make a successful rerun write an identical comment body and appear not to update.
