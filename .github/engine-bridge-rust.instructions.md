---
applyTo: "lynx/engine-bridge/**"
---

`lynx/engine-bridge` is an independent Cargo workspace whose only library crate is `lynx`; raw C ABI bindings live under `lynx::sys` rather than a separate bridge crate. Validate it from that directory with `cargo fmt --all --check`, `cargo clippy --locked --all-targets --all-features -- -D warnings`, and `cargo test --locked --all-targets --all-features`.

Runtime-loading tests are conditional: ordinary local tests do not need a Lynx runtime, but setting `LYNX_LIB_PATH` or `LYNX_SDK_DIR` should exercise real `libLynx_clay` loading. Keep CI downloading runtime dylibs into a temporary SDK directory instead of committing binary artifacts.

Headless screenshot references live under `lynx/engine-bridge/examples/headless/tests/fixtures/`. Update them only through the package test with `LYNX_UPDATE_REFERENCES=1 cargo test --locked -p lynx-headless-example --test screenshot`, then rerun the same test without the environment variable.

For macOS runtime experiments, remember that `LynxResources.bundle` is resolved through the process main bundle; for Cargo binaries that means placing the bundle beside `target/debug/lynx-headless-example` or the built test binary. Passing `--preload-js` can provide `lynx_core.js`, but it does not replace the runtime's bundle lookup.

Keep `README.md` and `docs/architecture.md` in sync with API or ownership changes. Do not add SDK packaging scripts unless the workspace also owns the build inputs and CI path that validate them.
