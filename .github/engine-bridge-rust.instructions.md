---
applyTo: "lynx/engine-bridge/**"
---

`lynx/engine-bridge` is an independent Cargo workspace whose only library crate is `lynx`; raw C ABI bindings live under `lynx::sys` rather than a separate bridge crate. Validate it from that directory with `cargo fmt --all --check`, `cargo clippy --locked --all-targets --all-features -- -D warnings`, and `cargo test --locked --all-targets --all-features`.

Runtime-loading tests are conditional: ordinary local tests do not need a Lynx runtime, but setting `LYNX_LIB_PATH` or `LYNX_SDK_DIR` should exercise real `libLynx_clay` loading. Keep CI downloading runtime dylibs into a temporary SDK directory instead of committing binary artifacts.
