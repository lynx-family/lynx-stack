---
applyTo: ".github/workflows/deploy-main.yml,.github/workflows/rust.yml,.github/workflows/test.yml,.github/ui-judge*.instructions.md"
---

Cover UI Judge through the existing Linux Rust workflow's workspace-wide all-features test command; do not add a separate UI Judge job. Keep the React fixture build and required native runtime packages in that Rust workflow. The command must compile the feature-gated `ui-judge-server` binary and its unit tests. Do not add a separate CLI job, Vitest, Playwright container, Android emulator, ADB, or Kitten-Lynx UI Judge test job.

Inject `UI_JUDGE_API_KEY`, `UI_JUDGE_BASE_URL`, and `UI_JUDGE_MODEL` secrets only into the Rust test step. Do not inject or accept legacy Midscene- or OpenAI-prefixed model variables, JSON init config, or model-family configuration. Use the Rust mock-response hook for deterministic unit tests. The runtime-backed `headless_e2e` integration test must reject mock-response variables unconditionally. It must skip inside the test when `UI_JUDGE_API_KEY` is absent or empty; otherwise it must use the injected real model configuration.

Do not add UI Judge result-comment jobs, PR-comment permissions, result artifacts whose only consumer is a comment job, or a JavaScript comment renderer. CI should validate the Rust library directly.

Build the UI Judge Linux AMD64 bundle in the deploy workflow's native Ubuntu build job with the root Cargo command, not `build.sh` or a Docker builder. Preserve executable modes by archiving the generated server, launcher, core script, and runtime library as a dedicated tar artifact; the `.turbo` artifact does not contain Rust outputs. After the reusable Rust test workflow succeeds, download that exact bundle and publish it as `ghcr.io/lynx-family/ui-judge` without recompiling Rust. Grant the publishing job only `contents: read` and `packages: write`, authenticate with `GITHUB_TOKEN`, and pin Docker-maintained actions to immutable commit SHAs. Publish a `latest` tag only from the default branch; publish sanitized branch and full commit-SHA tags for every deploy-workflow branch.
