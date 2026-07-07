---
applyTo: "lynx/headless-rust-test-runner/**"
---

`lynx/headless-rust-test-runner` is a Rust-only integration runner for the engine bridge. Keep it as a workspace rlib/bin crate that uses `lynx/engine-bridge/lynx`; do not add JS package metadata around it.

The React fixture bundle is a generated build output, not a copied runner fixture. Build it with `LYNX_HEADLESS_RUST_EXTERNAL_ASSETS=1 NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build --root packages/genui/ui-judge/tests/fixtures/react`, then read `packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle` directly from the Rust runner. Keep `fixtures/react/lynx_core.js` aligned with the external Lynx core output used by the runtime. Do not run ESLint, Biome, or dprint over runner fixture files.

Runtime-backed tests for this runner are Linux-only unless a PR explicitly expands the platform matrix. Native runtime loading currently expects `lynx_core.js` beside the test executable on Linux; install or copy the fixture core there before creating the view. Assert the rendered software frame through stable visual signals from the fixture source rather than through a fragile golden image.

Keep macOS support Rust-only. Do not add Swift, Objective-C, or Objective-C++ sources for the runner. On macOS, let the shipped runtime initialize its own UI message loop before creating the view; do not pre-register the windowless global UI task runner, because that replaces the UI runner with a delegate-only runner and prevents the default ALL_ON_UI TASM actor from executing.

The shipped macOS windowless software runtime currently presents text/backgrounds but does not paint PNG `<image>` nodes into the captured software frame, even with absolute `file://` asset URLs and no lifecycle errors. Treat macOS runner output as diagnostic until that runtime backend changes; keep CI coverage on Linux.
