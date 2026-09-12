---
applyTo: ".github/workflows/deploy-main.yml,.github/workflows/rust.yml,.github/workflows/test.yml,.github/ui-judge*.instructions.md"
---

Cover UI Judge through the existing Linux Rust workflow's workspace-wide all-features test command; do not add a separate UI Judge job. Keep the React fixture build and required native runtime packages in that Rust workflow. The command must compile the feature-gated `ui-judge-server` binary and its unit tests. Do not add a separate CLI job, Vitest, Playwright container, Android emulator, ADB, or Kitten-Lynx UI Judge test job.

UI Judge tests must run without model credentials or mock-response environment variables. Its runtime-backed `headless_e2e` test captures the built React fixture and compares real pixels; it must not skip based on model configuration. Keep model scoring tests in GenUI Server with deterministic provider mocks.

Do not add UI Judge result-comment jobs, PR-comment permissions, result artifacts whose only consumer is a comment job, or a JavaScript comment renderer. CI should validate the Rust library directly.

After the reusable Rust test workflow succeeds, build the UI Judge Linux AMD64 bundle and publish `ghcr.io/lynx-family/ui-judge` in the same job on a Lynx-hosted Ubuntu runner. Build with `packages/genui/ui-judge/build.sh`, not a Docker builder or a duplicated Cargo command, and give the script's verified output bundle directly to the runtime-only Dockerfile. Reference same-repository actions with GitHub's `$/` self-repository syntax. Grant the publishing job only `contents: read` and `packages: write`, authenticate with `GITHUB_TOKEN`, and pin Docker-maintained actions to immutable commit SHAs. Publish a `latest` tag only from the default branch; publish sanitized branch and full commit-SHA tags for every deploy-workflow branch.
