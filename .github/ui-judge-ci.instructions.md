---
applyTo: ".github/workflows/test.yml,.github/workflows/workflow-test.yml,.github/scripts/write-ui-judge-failure-result.mjs,.github/ui-judge*.instructions.md,.github/actions/ui-judge-comment/**"
---

When wiring `@lynx-js/ui-judge` into pull request CI, preserve the PR comment even when the model-backed test fails, but do not hide the failed test. Prefer running UI Judge through the reusable `workflow-test.yml` job with `is-web: true`, uploading `ui-judge-results.json` as an artifact, and posting the comment from a separate thin job with `issues: write` and `pull-requests: write`.

Keep long UI Judge work inside a job with a bounded timeout, and write a fallback `ui-judge-results.json` before artifact upload when build or test execution fails. If UI Judge setup is ever split back into custom steps outside the reusable workflow, use step-level `timeout-minutes` on long setup, build, and model execution steps so the fallback result writer and PR comment action still run.

Keep the UI Judge Playwright job dependent on the repository `build` job, matching the `playwright-web-elements` dependency shape. Let the reusable `workflow-test.yml` run its default `pnpm turbo build --summarize`; do not add UI Judge-specific `build-run` overrides. The A2UI playground Turbo config already makes `build` depend on `build:lynx`.

Use the upstream build job's restored turbo cache in UI Judge CI. Do not call package scripts directly with `pnpm --filter <package> build`, and do not pass `--force`; use Turbo commands so dependency ordering and cached outputs remain consistent.

Do not add changed-file gating, GitHub API calls, or reusable-workflow `preflight-run` wiring to UI Judge CI. If Midscene secrets are unavailable, the UI Judge test command should write a clear skipped result and exit successfully; fork pull requests should skip the comment steps rather than requiring write permissions.

Raise the soft open-file limit before running UI Judge Playwright tests in the Playwright container. The A2UI playground dev server uses rsbuild/chokidar watchers, so mirror the web-elements Playwright pattern with `ulimit -Sn 655350` before invoking `pnpm --filter @lynx-js/ui-judge test`.

Inject the full Midscene/OpenAI model environment into the UI Judge execution step, including `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_FAMILY`, `MIDSCENE_MODEL_NAME`, and `MIDSCENE_OPENAI_INIT_CONFIG_JSON`.

When rendering the UI Judge PR comment, include `GITHUB_RUN_ATTEMPT` in the workflow footer/link. GitHub reruns keep the same `GITHUB_RUN_ID`, so relying only on the run URL can make a successful rerun write an identical comment body and appear not to update.

Keep `.github/actions/ui-judge-comment` self-contained for self-hosted runners: set up Node inside the composite action before invoking `comment.mjs`, rather than requiring every caller job to prepare `node` separately.
