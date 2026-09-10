---
applyTo: ".github/workflows/rust.yml,.github/workflows/test.yml,.github/ui-judge*.instructions.md"
---

Cover UI Judge through the existing Linux Rust workflow's workspace-wide all-features test command; do not add a separate UI Judge job. Keep the React fixture build and required native runtime packages in that Rust workflow. The command must compile the feature-gated `ui-judge-server` binary and its unit tests. Do not add a separate CLI job, Vitest, Playwright container, Android emulator, ADB, or Kitten-Lynx UI Judge test job.

UI Judge tests must run without model credentials or mock-response environment variables. Its runtime-backed `headless_e2e` test captures the built React fixture and compares real pixels; it must not skip based on model configuration. Keep model scoring tests in GenUI Server with deterministic provider mocks.

Do not add UI Judge result-comment jobs, PR-comment permissions, result artifacts whose only consumer is a comment job, or a JavaScript comment renderer. CI should validate the Rust library directly.
