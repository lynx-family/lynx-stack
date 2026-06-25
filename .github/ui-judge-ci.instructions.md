---
applyTo: ".github/workflows/test.yml,.github/workflows/workflow-test.yml,.github/ui-judge*.instructions.md"
---

Run `@lynx-js/ui-judge` package tests through Rust with `cargo test -p ui_judge --all-targets --all-features` on a Linux runner with the Rust toolchain available. When routing cargo commands through `.github/workflows/workflow-test.yml`, set `install-rust: true` so the reusable workflow invokes `./.github/actions/rustup` on that runner. Do not add a Vitest package job for UI Judge; screenshot visual-evaluation coverage should live in Rust unit or integration tests. It should not use the Playwright container or upload Playwright reports.

Keep UI Judge CI dependent on the repository `build` job through the reusable `workflow-test.yml`, so the reusable workflow still runs its root `pnpm turbo build --summarize` before tests.

Keep Android model-backed UI Judge coverage in the Rust Android emulator job. That job should run the Rust Android e2e test and remember its exit code, then still use `cargo run -p ui_judge --bin ui-judge -- judge-android-agent` to produce result JSON from JSON scenarios when model credentials are available. If model credentials are unavailable or model scoring fails, use the Rust `report` subcommand to emit a score-0 fallback JSON payload before the job exits.

Keep CI-facing model secret names on the existing `MIDSCENE_MODEL_*` and `MIDSCENE_OPENAI_INIT_CONFIG_JSON` names. Do not add `OPENAI_*` or `A2UI_BENCH_JUDGE_*` workflow secrets for UI Judge. When changing PR-comment wiring in `test.yml`, keep the existing runner class and pinned artifact actions unless there is a separate workflow-wide reason to change them.

For new UI Judge CI wiring, upload `ui-judge-results.json` and pass it to `.github/actions/ui-judge-comment` through `result-file`. Rust owns Android capture, scoring, GEQI result data, and fallback JSON generation; the JavaScript action owns Markdown rendering and GitHub PR comment create/update. Do not bypass the action with Rust-generated Markdown in CI.

Do not add changed-file gating or GitHub API calls to the Rust screenshot unit-test job.
