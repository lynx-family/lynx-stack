---
applyTo: ".github/workflows/test.yml,.github/actions/ui-judge-comment/**"
---

When wiring `@lynx-js/ui-judge` into pull request CI, preserve the PR comment even when the model-backed test fails, but do not hide the failed test. Use `continue-on-error` only on the judge execution step, run the comment action afterward with `always()`, then add a final failing step keyed to `steps.<judge-step-id>.outcome == 'failure'`.

Use step-level `timeout-minutes` on long UI Judge setup, build, and model execution steps so a hung prerequisite fails early enough for the fallback result writer and PR comment action to run before the job-level timeout kills the whole job.

Keep the UI Judge Playwright job dependent on the repository `build` job, matching the `playwright-web-elements` pattern. Restore the same strict `.turbo` cache key with `fail-on-cache-miss: true`, run `pnpm turbo build --summarize` in the Playwright container, then run the UI Judge-specific playground artifact preparation and package test.

Inject the full Midscene/OpenAI model environment into the UI Judge execution step, including `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_FAMILY`, `MIDSCENE_MODEL_NAME`, and `MIDSCENE_OPENAI_INIT_CONFIG_JSON`.
