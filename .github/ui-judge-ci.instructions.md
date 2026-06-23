---
applyTo: ".github/workflows/test.yml,.github/workflows/workflow-test.yml,.github/ui-judge*.instructions.md"
---

Run `@lynx-js/ui-judge` CI as a normal Vitest package job with `pnpm --filter @lynx-js/ui-judge test` on a Linux runner. It should not use the Playwright container, upload Playwright reports, require Midscene secrets, or publish a model-backed PR comment artifact.

Keep UI Judge CI dependent on the repository `build` job through the reusable `workflow-test.yml`, so the reusable workflow still runs its root `pnpm turbo build --summarize` before tests.

Do not add changed-file gating, GitHub API calls, or UI Judge-specific reusable workflow inputs for the screenshot unit-test job.
