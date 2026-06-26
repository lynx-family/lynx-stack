# Lynx Rust headless crate

This workspace publishes Lynx as a runtime-loaded Rust crate for windowless
embedding. It does not expose windowed APIs or NativeView.

## Crate

- `lynx` provides checked-in C ABI bindings under `lynx::sys`, loads
  `libLynx_clay` with `dlopen`/`dlsym`, and exposes RAII wrappers for the
  headless view, windowless renderer, resource fetcher, task runner, input
  events, and platform callbacks. It expects the runtime library to export the
  Rust-friendly `lynx_rust_*` C ABI shim symbols.
- `examples/headless` shows a minimal software renderer and resource fetcher.

## Library loading

The crate does not link `libLynx_clay` at build time. `cargo test` can run
without an SDK because real loading only starts when you call `Env::load()` or
`Env::load_from_path()`.

`lynx::sys` resolves Rust-only C ABI exports, such as `lynx_rust_view_set_frame`.
Those shims are intentionally expected from `libLynx_clay` so the existing C++
exports with reference parameters can remain unchanged for current C++
embedders.

Set one of these environment variables before creating `Env`:

```sh
export LYNX_LIB_PATH=/path/to/libLynx_clay.dylib
export LYNX_SDK_DIR=/path/to/lynx-sdk
```

`LYNX_LIB_PATH` wins for the runtime library. If it is not set, `Env::load()`
tries `$LYNX_SDK_DIR/lib/libLynx_clay.dylib` on macOS and
`$LYNX_SDK_DIR/lib/libLynx_clay.so` on Linux. It also accepts the root build-dir
layout used by local GN builds, where `libLynx_clay.{dylib,so}` sits directly
under `$LYNX_SDK_DIR`.

## macOS signing

Ordinary `cargo test` does not require Developer ID signing because Cargo test
binaries are not signed with Hardened Runtime or Library Validation by default.
For local Rust SDKs, run `tools/adhoc_sign_macos_sdk.py <sdk-dir>` from this
workspace to ad-hoc sign `libLynx_clay.dylib` when present.

Apps or CLI tools that redistribute `libLynx_clay.dylib` need to sign and notarize
their final bundle with their own Apple Team ID.

## Run tests

Run the Rust workspace tests from this folder:

```sh
cargo test
```

Run the headless example after setting `LYNX_LIB_PATH` or `LYNX_SDK_DIR`.
The example waits for a non-transparent software frame and writes a PNG
screenshot:

```sh
LYNX_SDK_DIR=/path/to/lynx-sdk \
cargo run -p lynx-headless-example -- \
  --bundle ../explorer/homepage/dist/main.lynx.bundle \
  --asset-root ../explorer/homepage/dist \
  --asset-root /path/to/lynx-sdk/bundles/LynxResources.bundle/Contents/Resources \
  --screenshot /tmp/lynx-headless.png
```
