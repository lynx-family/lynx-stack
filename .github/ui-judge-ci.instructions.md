---
applyTo: ".github/workflows/test.yml,.github/workflows/workflow-test.yml,.github/ui-judge*.instructions.md"
---

Run `@lynx-js/ui-judge` TypeScript CI as a normal Vitest package job with `pnpm --filter @lynx-js/ui-judge test` on a Linux runner. It should not use the Playwright container or upload Playwright reports.

Keep UI Judge CI dependent on the repository `build` job through the reusable `workflow-test.yml`, so the reusable workflow still runs its root `pnpm turbo build --summarize` before tests.

Keep Android model-backed UI Judge coverage in the Rust Android emulator job. That job should run the Rust Android e2e test, then use `cargo run -p ui_judge --bin ui-judge -- judge-android-agent` to produce result JSON and PR-comment Markdown from JSON scenarios. If model credentials are unavailable, use the Rust `report` subcommand to emit a score-0 fallback report instead of failing before a comment artifact exists.

Use `.github/actions/ui-judge-comment` only to create or update the GitHub PR comment from Rust-generated Markdown. Do not put scoring or GEQI formatting logic in the JavaScript comment action.

Do not add changed-file gating or GitHub API calls to the screenshot unit-test job.
