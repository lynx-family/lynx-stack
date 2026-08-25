---
applyTo: "packages/lynx/engine-bridge/**"
---

`packages/lynx/engine-bridge/lynx` is the `lynx` rlib crate and a member of the repository Cargo workspace; raw C ABI bindings live under `lynx::sys` rather than a separate bridge crate. Do not add CLI/example binaries under `packages/lynx/engine-bridge`. Prefer validating it through the root Rust workflow commands: `cargo fmt --check`, `cargo clippy --tests --all-features -- -D warnings`, and the CI test job's `cargo llvm-cov nextest --all-targets --all-features --profile ci --config-file .cargo/nextest.toml --lcov --output-path lcov.info --release`. Use `cargo test --locked -p lynx --all-targets --all-features` only as a focused local loop.

Runtime-backed tests require a Lynx runtime locally and in CI. Package `build.rs` files should prepare the default runtime artifact for supported targets under `target/lynx-engine-bridge-sdk` and inject `LYNX_SDK_DIR`; avoid separate downloader scripts unless they are needed outside Cargo. Do not add a separate engine-bridge CI job while `lynx` remains in the root Cargo workspace; let the main Rust workflow run it with the rest of the workspace. The Linux workspace test job should install the `libepoxy0` system package before loading `libLynx_clay.so`. Missing runtime configuration should fail runtime integration tests instead of skipping them.

Follow a Let it crash style in engine-bridge Rust code. Prefer one documented runtime path over guessing alternate locations, and surface configuration or I/O errors with specific messages instead of silently falling back to defaults. Keep defensive `catch_unwind` only at FFI boundaries where Rust panics must not cross into C ABI frames.

Keep Rust integration coverage for the `lynx` library crate under `packages/lynx/engine-bridge/lynx/tests/`. These tests should cover public API behavior, and runtime-backed cases should load the configured dylib/so rather than using mocks. Do not add screenshot or image-golden tests to the engine bridge workspace unless product requirements need visual regression coverage.

Keep the safe API surface tied to exercised workflows. `LoadedLibrary` is a capability-focused symbol table: eagerly load the exports required by implemented bridge capabilities, but do not mechanically import every service or subsystem declared by the SDK. Do not add view-client lifecycle wrappers, callback glue, or extra dylib symbols unless a committed integration path uses them or a task explicitly requires synchronizing the bridge with newer public C headers; keep raw callback and platform-handle wrappers unsafe.

Keep public CAPI functions without a Rust consumer out of `LoadedLibrary`. Preserve their checked signatures as comments grouped by declaring header, and move them into the active manifest only when an implementation path actually calls them.

Copy each available function comment from its declaring public CAPI header verbatim into the active loader manifest as Rust `///` documentation. Do not invent documentation for CAPI declarations whose headers do not document the function; preserve source comments alongside any intentionally disabled signature.

Treat the complete `public/capi/*.h` header tree as the runtime ABI source of truth; do not infer the SDK contract from `lynx_view_capi.h` or another individual header. C exports declared with C++ reference parameters such as `const float&` must be bound as pointers (for example, `*const f32`) and called with stable addresses; do not require private `lynx_rust_*` shim exports. When a newly documented symbol is absent from the repository's current default runtime artifact, resolve it optionally and make the calling API report that it is unavailable instead of preventing the entire runtime from loading.

Preserve the windowless builder, renderer, resource, metadata, environment, and view capabilities exercised by `lynx-headless-rust-test-runner`. The downstream headless page-capture and DevTools paths remain supported integration workflows; do not remove them because an individual public header omits declarations owned by another header. Do not move screenshot capture or DebugRouter application logic into the engine bridge.

Keep `README.md` and `docs/architecture.md` in sync with API or ownership changes. Do not add SDK packaging scripts unless the workspace also owns the build inputs and CI path that validate them.
