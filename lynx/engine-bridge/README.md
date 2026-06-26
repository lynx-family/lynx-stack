# Lynx Rust engine bridge

This workspace contains the Rust bridge for embedding Lynx without a native
window. It provides one library crate, `lynx`, and a headless example.

The Rust crate loads `libLynx_clay` at runtime with `dlopen` and `dlsym`. It
does not link the runtime library at build time, so normal Rust builds and unit
tests can run without a local Lynx SDK.

## Scope

Use this workspace when you need to:

- load a prebuilt `libLynx_clay` runtime from Rust
- create a headless Lynx view
- provide a windowless renderer callback
- serve bundle, image, font, or other resources from Rust
- drive Lynx tasks and input events in a non-windowed host

This workspace does not build `libLynx_clay`, package a full SDK, or expose
windowed APIs such as `NativeView`.

## Layout

- `lynx/` contains the Rust library crate.
- `lynx/src/sys/` contains checked-in C ABI types and runtime symbol loading.
- `examples/headless/` contains a software-rendering example that writes a PNG.
- `tools/adhoc_sign_macos_sdk.py` ad-hoc signs a downloaded macOS runtime for
  local or CI loading.
- `docs/architecture.md` describes the crate boundaries and ownership model.

## Runtime loading

Set one of these environment variables before calling `Env::load()`:

```sh
export LYNX_LIB_PATH=/path/to/libLynx_clay.dylib
export LYNX_SDK_DIR=/path/to/lynx-sdk
```

`LYNX_LIB_PATH` wins when both variables are set. If only `LYNX_SDK_DIR` is set,
the loader checks these paths:

- `$LYNX_SDK_DIR/lib/libLynx_clay.dylib` on macOS
- `$LYNX_SDK_DIR/lib/libLynx_clay.so` on Linux
- `$LYNX_SDK_DIR/libLynx_clay.dylib` on macOS
- `$LYNX_SDK_DIR/libLynx_clay.so` on Linux

The loaded runtime must export the `lynx_rust_*` shim symbols, such as
`lynx_rust_view_set_frame`. These symbols keep the Rust ABI simple while the
existing C++ exports can keep reference-parameter signatures.

## macOS signing

Cargo test binaries are not signed with Hardened Runtime or Library Validation,
so ordinary local tests do not need Developer ID signing.

If macOS refuses to load a downloaded runtime, ad-hoc sign it from this
workspace:

```sh
tools/adhoc_sign_macos_sdk.py /path/to/lynx-sdk
```

The script signs `lib/libLynx_clay.dylib` and `libLynx_clay.dylib` when they are
present under the SDK folder.

## Validation

Run Rust checks from this folder:

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets --all-features
```

To run the runtime-loading test, set `LYNX_LIB_PATH` or `LYNX_SDK_DIR` first:

```sh
LYNX_SDK_DIR=/path/to/lynx-sdk \
cargo test --locked --all-targets --all-features
```

The CI job downloads the macOS runtime dylib into a temporary SDK folder,
ad-hoc signs it, sets `LYNX_SDK_DIR`, and runs the same checks.

## Run the headless example

The example loads a Lynx bundle, waits for a non-transparent software frame, and
writes a PNG screenshot.

```sh
LYNX_SDK_DIR=/path/to/lynx-sdk \
cargo run -p lynx-headless-example -- \
  --bundle /path/to/main.lynx.bundle \
  --asset-root /path/to/assets \
  --asset-root /path/to/lynx-sdk/bundles/LynxResources.bundle/Contents/Resources \
  --screenshot /tmp/lynx-headless.png
```

Use `--initial-data-json` and `--global-props-json` to pass JSON strings to the
template load request.

## Troubleshooting

`libLynx_clay was not found`

Set `LYNX_LIB_PATH` to the exact runtime library path, or set `LYNX_SDK_DIR` to a
folder that contains the runtime in `lib/`.

`failed to load symbol lynx_rust_*`

The runtime was built without the Rust-friendly shim exports. Use a runtime
artifact that includes those symbols.

`resource not found`

Add each folder that can contain bundle dependencies with `--asset-root`. The
example checks each asset root and then the bundle's parent folder.
