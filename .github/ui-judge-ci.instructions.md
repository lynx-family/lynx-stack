---
applyTo: ".github/workflows/test.yml,.github/actions/ui-judge-comment/**"
---

When wiring `@lynx-js/ui-judge` into pull request CI, preserve the PR comment even when the model-backed test fails, but do not hide the failed test. Use `continue-on-error` only on the judge execution step, run the comment action afterward with `always()`, then add a final failing step keyed to `steps.<judge-step-id>.outcome == 'failure'`.

Use step-level `timeout-minutes` on long UI Judge setup, build, and model execution steps so a hung prerequisite fails early enough for the fallback result writer and PR comment action to run before the job-level timeout kills the whole job.

Keep the UI Judge Playwright job dependent on the repository `build` job, matching the `playwright-web-elements` dependency shape. Restore the same strict `.turbo` cache key with `fail-on-cache-miss: true`, but do not repeat a broad full-repository build in the Playwright container; build the UI Judge package and the A2UI playground prerequisites that the test actually consumes.

When the A2UI playground preview needs Rspeedy in CI, build `@lynx-js/rspeedy` through turbo with its workspace dependencies, for example `pnpm turbo build --filter @lynx-js/rspeedy... --force`, instead of calling `pnpm --filter @lynx-js/rspeedy build` directly.

Inject the full Midscene/OpenAI model environment into the UI Judge execution step, including `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_FAMILY`, `MIDSCENE_MODEL_NAME`, and `MIDSCENE_OPENAI_INIT_CONFIG_JSON`.

When rendering the UI Judge PR comment, include `GITHUB_RUN_ATTEMPT` in the workflow footer/link. GitHub reruns keep the same `GITHUB_RUN_ID`, so relying only on the run URL can make a successful rerun write an identical comment body and appear not to update.
