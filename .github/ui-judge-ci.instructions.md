---
applyTo: ".github/workflows/test.yml,.github/workflows/workflow-test.yml,.github/ui-judge*.instructions.md"
---

Run `@lynx-js/ui-judge` package tests through Rust with `cargo test -p ui_judge --all-targets --all-features` on a Linux runner with the Rust toolchain available. Do not add a Vitest package job for UI Judge; screenshot visual-evaluation coverage should live in Rust unit or integration tests. It should not use the Playwright container or upload Playwright reports.

Keep UI Judge CI dependent on the repository `build` job through the reusable `workflow-test.yml`, so the reusable workflow still runs its root `pnpm turbo build --summarize` before tests.

Keep Android model-backed UI Judge coverage in the Rust Android emulator job. That job should run the Rust Android e2e test, then use `cargo run -p ui_judge --bin ui-judge -- judge-android-agent` to produce result JSON and PR-comment Markdown from JSON scenarios. If model credentials are unavailable, use the Rust `report` subcommand to emit a score-0 fallback report instead of failing before a comment artifact exists.

For new UI Judge CI wiring, use `.github/actions/ui-judge-comment` only to create or update the GitHub PR comment from Rust-generated Markdown. Keep the action's existing JSON result rendering path for backward compatibility, but do not add new scoring, GEQI dimensions, or report-generation logic to the JavaScript action.

Do not add changed-file gating or GitHub API calls to the Rust screenshot unit-test job.
