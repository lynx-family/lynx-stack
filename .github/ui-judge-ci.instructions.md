---
applyTo: ".github/workflows/rust.yml,.github/workflows/test.yml,.github/ui-judge*.instructions.md"
---

Cover UI Judge through the existing Linux Rust workflow's workspace-wide all-features test command; do not add a separate UI Judge job. Keep the React fixture build and required native runtime packages in that Rust workflow. The command must compile the feature-gated `ui-judge-server` binary and its unit tests. Do not add a separate CLI job, Vitest, Playwright container, Android emulator, ADB, or Kitten-Lynx UI Judge test job.

Inject `MIDSCENE_MODEL_*` and legacy `MIDSCENE_OPENAI_INIT_CONFIG_JSON` secrets only into the Rust test step for configuration compatibility. Use the Rust mock-response hook for deterministic unit tests. The runtime-backed `headless_e2e` integration test must reject mock-response variables unconditionally. It must skip inside the test when all supported real credential variables are absent or empty; otherwise it must use the injected real model configuration. The crate must continue accepting `MIDSCENE_MODEL_INIT_CONFIG_JSON` in deployments even though CI does not currently define that canonical secret.

Do not add UI Judge result-comment jobs, PR-comment permissions, result artifacts whose only consumer is a comment job, or a JavaScript comment renderer. CI should validate the Rust library directly.
