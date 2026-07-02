# Lynx Rust engine bridge

This workspace contains the Rust `lynx` rlib for embedding a prebuilt
`libLynx_clay` runtime in a non-windowed host. It does not ship a CLI or
runnable example binary.

The crate loads `libLynx_clay` at runtime with `libloading`. It does not link
the runtime library at build time. Cargo builds prepare the downloaded runtime
through `build.rs` so local development and CI exercise the same dynamic library
path.

## Scope

Use this workspace when you need to:

- load a prebuilt `libLynx_clay` runtime from Rust
- create a headless Lynx view
- provide a windowless renderer callback
- serve bundle, image, font, or other resources from Rust
- drive Lynx tasks and input events in a non-windowed host

This workspace does not build `libLynx_clay`, package a full SDK, expose
windowed APIs such as `NativeView`, or provide CLI/example binaries.

## Layout

- `lynx/` contains the Rust library crate.
- `lynx/src/sys/` contains checked-in C ABI types and runtime symbol loading.
- `tools/runtime_build.rs` is included by package `build.rs` files so runtime
  setup, download, and ad-hoc signing stay consistent.
- `docs/architecture.md` describes the crate boundaries and ownership model.

## How the bridge works

The bridge follows this runtime path:

1. `Env::load()` finds and opens `libLynx_clay` from `LYNX_LIB_PATH` or
   `LYNX_SDK_DIR`.
2. `lynx::sys::LoadedLibrary` resolves the required C ABI symbols.
3. `WindowlessRenderer` and `GenericResourceFetcher` register Rust callbacks
   with the runtime.
4. `HeadlessViewBuilder` binds the renderer, resource fetcher, optional
   `LynxGroup`, viewport metrics, ICU path, and module registrations.
5. `HeadlessView` owns the runtime view and exposes template loading, data
   updates, global events, viewport changes, and lifecycle methods.

See `docs/architecture.md` for the module walkthrough and CI workflow.

## Configure the runtime

Cargo builds prepare a default runtime for supported targets when neither
`LYNX_LIB_PATH` nor `LYNX_SDK_DIR` is set. To use your own runtime, set one of
these environment variables before building or before calling `Env::load()` from
a non-Cargo host:

```sh
export LYNX_LIB_PATH=/path/to/libLynx_clay.dylib # or libLynx_clay.so
export LYNX_SDK_DIR=/path/to/lynx-sdk
```

`LYNX_LIB_PATH` wins when both variables are set. If only `LYNX_SDK_DIR` is set,
the loader checks one canonical path for the current platform:

- `$LYNX_SDK_DIR/lib/libLynx_clay.dylib` on macOS
- `$LYNX_SDK_DIR/lib/libLynx_clay.so` on Linux

The loaded runtime must export the `lynx_rust_*` shim symbols, such as
`lynx_rust_view_set_frame`. These symbols keep the Rust ABI narrow while the
existing C++ exports keep reference-parameter signatures.

When Cargo downloads a runtime, it stores the files under
`target/lynx-engine-bridge-sdk` and injects `LYNX_SDK_DIR` for tests. Existing
non-empty runtime files are reused when they match the current runtime URL. The
default artifacts are available for macOS arm64 and Linux x86_64.

Use these build-time variables to change the default behavior:

- `LYNX_DOWNLOAD_RUNTIME=0` disables the automatic download.
- `LYNX_RUNTIME_URL` downloads a different runtime artifact.
- `LYNX_SKIP_ADHOC_SIGN=1` skips ad-hoc signing on macOS.

## macOS signing

Cargo test binaries are not signed with Hardened Runtime or Library Validation,
so ordinary local tests do not need Developer ID signing.

On macOS, Cargo ad-hoc signs the downloaded runtime before building tests. To
refresh the downloaded artifact, remove the runtime library under
`target/lynx-engine-bridge-sdk/lib/` and rerun Cargo.

## Validation

Run Rust checks from this folder:

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets --all-features
```

The runtime-backed tests use the runtime prepared by `build.rs`. If you have an
SDK already, set it directly:

```sh
LYNX_SDK_DIR=/path/to/lynx-sdk \
cargo test --locked --all-targets --all-features
```

The CI job runs on Linux only. It lets `build.rs` download the Linux runtime
artifact into `target/lynx-engine-bridge-sdk`, inject `LYNX_SDK_DIR`, and run the
same checks. The Linux runtime also needs `libepoxy.so.0`; install the
`libepoxy0` system package before running runtime-backed tests locally on Linux.
macOS uses the same Rust code path and remains available for local development,
but it is not required as a PR check.

The `lynx/tests/runtime.rs` integration test belongs to the library crate. It
contains public API tests and runtime-backed tests. Runtime-backed tests fail
when no runtime is available, so keep `build.rs` and CI in sync.

## Troubleshooting

`libLynx_clay was not found`

Set `LYNX_LIB_PATH` to the exact runtime library path, or set `LYNX_SDK_DIR` to a
folder that contains the runtime in `lib/`.

`failed to load symbol lynx_rust_*`

The runtime was built without the Rust-friendly shim exports. Use a runtime
artifact that includes those symbols.

`libepoxy.so.0: cannot open shared object file`

Install the Linux runtime dependency with your system package manager. On Ubuntu
24.04, install `libepoxy0`.

Resource requests fail

Resource resolution is owned by the host-provided `GenericResourceFetcher`.
Check that your fetcher maps the runtime request URL to the resource bytes your
bundle expects.
