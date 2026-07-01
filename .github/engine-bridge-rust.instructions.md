---
applyTo: "lynx/engine-bridge/**"
---

`lynx/engine-bridge` is an independent Cargo workspace whose only library crate is `lynx`; raw C ABI bindings live under `lynx::sys` rather than a separate bridge crate. Validate it from that directory with `cargo fmt --all --check`, `cargo clippy --locked --all-targets --all-features -- -D warnings`, and `cargo test --locked --all-targets --all-features`.

Runtime-backed tests require a Lynx runtime locally and in CI. Use `python3 tools/download_runtime.py --emit-env` from `lynx/engine-bridge` for local setup, and keep CI downloading runtime dylibs into a temporary SDK directory instead of committing binary artifacts. Missing `LYNX_LIB_PATH` or `LYNX_SDK_DIR` should fail runtime integration tests instead of skipping them.

Keep Rust integration coverage for the `lynx` library crate under `lynx/engine-bridge/lynx/tests/`. These tests should cover public API behavior independently from `examples/headless`, and runtime-backed cases should load the configured dylib/so rather than using mocks.

Headless screenshot coverage should run the real GenUI React fixture bundle at `packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle` and pixel-compare against `packages/genui/ui-judge/tests/fixtures/react/main.lynx.snapshot.png` with tolerance for runner-level antialiasing. Update that reference only through `LYNX_UPDATE_REFERENCES=1 cargo test --locked -p lynx-headless-example --test screenshot`, then rerun the same test without the environment variable.

For macOS runtime experiments, remember that `LynxResources.bundle` is resolved through the process main bundle; for Cargo binaries that means placing the bundle beside `target/debug/lynx-headless-example` or the built test binary. Passing `--preload-js` can provide `lynx_core.js`, but it does not replace the runtime's bundle lookup. Real React fixture rendering should use `--native-ui-loop`; the Rust queue-backed global UI runner does not drive every FML actor used by ReactLynx.

Keep the safe API surface tied to exercised workflows. Do not add view-client lifecycle wrappers, callback glue, or extra dylib symbols only for debugging screenshot tests unless a committed integration path uses them.

Treat files under `examples/headless/tests/fixtures/LynxResources.bundle` as vendored runtime resources. Keep them out of repository-wide formatting, lint, and typo checks; they are copied beside the Cargo-built binary so macOS `NSBundle` lookup can resolve `lynx_core.js`.

Keep `README.md` and `docs/architecture.md` in sync with API or ownership changes. Do not add SDK packaging scripts unless the workspace also owns the build inputs and CI path that validate them.
