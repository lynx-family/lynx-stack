---
applyTo: "lynx/engine-bridge/**"
---

`lynx/engine-bridge` is an independent Cargo workspace whose only library crate is `lynx`; raw C ABI bindings live under `lynx::sys` rather than a separate bridge crate. Validate it from that directory with `cargo fmt --all --check`, `cargo clippy --locked --all-targets --all-features -- -D warnings`, and `cargo test --locked --all-targets --all-features`.

Runtime-backed tests require a Lynx runtime locally and in CI. Package `build.rs` files should prepare the default runtime artifact for supported targets under `target/lynx-engine-bridge-sdk` and inject `LYNX_SDK_DIR`; avoid separate downloader scripts unless they are needed outside Cargo. CI should run the Engine Bridge checks on Linux only unless there is a product requirement to validate platform differences. Missing runtime configuration should fail runtime integration tests instead of skipping them.

Follow a Let it crash style in engine-bridge Rust code. Prefer one documented runtime path over guessing alternate locations, and surface configuration or I/O errors with specific messages instead of silently falling back to defaults. Keep defensive `catch_unwind` only at FFI boundaries where Rust panics must not cross into C ABI frames.

Keep Rust integration coverage for the `lynx` library crate under `lynx/engine-bridge/lynx/tests/`. These tests should cover public API behavior independently from `examples/headless`, and runtime-backed cases should load the configured dylib/so rather than using mocks. Do not add screenshot or image-golden tests to the engine bridge workspace unless product requirements need visual regression coverage.

Keep the safe API surface tied to exercised workflows. Do not add view-client lifecycle wrappers, callback glue, or extra dylib symbols unless a committed integration path uses them.

Keep `README.md` and `docs/architecture.md` in sync with API or ownership changes. Do not add SDK packaging scripts unless the workspace also owns the build inputs and CI path that validate them.
