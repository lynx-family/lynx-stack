# Lynx Rust engine bridge

This folder contains the Rust `lynx` rlib for embedding a prebuilt
`libLynx_clay` runtime in a non-windowed host. The crate is part of the
repository Cargo workspace. It does not ship a CLI or runnable example binary.

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
- provide the rendering and DevTools primitives used by headless page capture

This workspace does not build `libLynx_clay`, package a full SDK, implement
platform-native view objects, or provide CLI/example binaries. It does expose
the public C API hooks needed to register a host-provided native-view factory.

## Layout

- `lynx/` contains the Rust library crate and Cargo workspace member.
- `lynx/src/sys/` contains checked-in C ABI types and runtime symbol loading.
- `tools/runtime_build.rs` is included by package `build.rs` files so runtime
  and `lynx_core.js` downloads, verification, and runtime ad-hoc signing stay
  consistent.
- `docs/architecture.md` describes the crate boundaries and ownership model.

## How the bridge works

The bridge follows this runtime path:

1. `LynxEnv::load()` initializes the process-wide environment and opens
   `libLynx_clay` from `LYNX_LIB_PATH` or
   `LYNX_SDK_DIR`.
2. `lynx::sys::LoadedLibrary` resolves the C ABI symbols used by the bridge's
   supported capabilities.
3. `WindowlessRenderer` and `GenericResourceFetcher` register Rust callbacks
   with the runtime.
4. `HeadlessViewBuilder` binds the renderer, resource fetcher, optional
   `LynxGroup`, viewport metrics, ICU path, JavaScript runtime setting, and
   module registrations.
5. `LynxView` owns the runtime view and exposes template loading, data
   updates, global events, viewport changes, and lifecycle methods.

See `docs/architecture.md` for the module walkthrough and CI workflow.

## Configure the runtime

Cargo builds prepare a default runtime for supported targets when neither
`LYNX_LIB_PATH` nor `LYNX_SDK_DIR` is set. To use your own runtime, set one of
these environment variables before building or before calling
`LynxEnv::load()` from a non-Cargo host:

```sh
export LYNX_LIB_PATH=/path/to/libLynx_clay.dylib # or libLynx_clay.so
export LYNX_SDK_DIR=/path/to/lynx-sdk
```

`LYNX_LIB_PATH` wins when both variables are set. If only `LYNX_SDK_DIR` is set,
the loader checks one canonical path for the current platform:

- `$LYNX_SDK_DIR/lib/libLynx_clay.dylib` on macOS
- `$LYNX_SDK_DIR/lib/libLynx_clay.so` on Linux

The complete `public/capi/*.h` header tree is the source of truth for the
runtime ABI. Do not infer the SDK surface from `lynx_view_capi.h` alone: view
creation, windowless rendering, resources, load metadata, and DevTools are
declared across separate headers. The bridge uses those public `lynx_*` exports
directly and does not require private `lynx_rust_*` shim symbols.

`LoadedLibrary` is a capability-focused symbol table, not a mirror of every SDK
subsystem. It eagerly resolves only the exports required by the bridge's
implemented and exercised workflows, including the primitives used by the
headless page-capture and DevTools paths. A newly documented export remains
optional when the repository's default runtime does not provide it. Calling
the corresponding safe method then returns `UnsupportedRuntimeApi` without
preventing other runtime capabilities from loading.

Some public functions declare numeric inputs as C++ `const float&` parameters
even though they have C linkage. The raw Rust ABI binds those parameters as
pointers, and the safe API passes stable addresses.

When Cargo downloads Lynx artifacts, it stores the runtime and `lynx_core.js`
under one SDK directory and injects their paths for tests. The default directory
is `target/lynx-engine-bridge-sdk`. When `LYNX_SDK_DIR` is set and
`LYNX_CORE_JS_PATH` is not, Cargo first checks
`$LYNX_SDK_DIR/resources/lynx_core.js` and downloads a missing core script into
that location. Existing files in an explicitly configured SDK are treated as
SDK inputs. Existing automatically downloaded artifacts are reused when their
URL and SHA-256 markers match the configured values. The default artifacts are
available for macOS arm64 and Linux x86_64.

Core-script resolution uses this priority order: `LYNX_CORE_JS_PATH`, then
`$LYNX_SDK_DIR/resources/lynx_core.js`, then the corresponding paths injected
by Cargo's default SDK preparation. Runtime environment variables take
precedence over build-time defaults.

Use these build-time variables to change the default behavior:

- `LYNX_DOWNLOAD_RUNTIME=0` disables automatic runtime and `lynx_core.js`
  downloads.
- `CUSTOM_LYNX_RUNTIME_URL` downloads a different runtime artifact.
- `CUSTOM_LYNX_RUNTIME_SHA256` is required when `CUSTOM_LYNX_RUNTIME_URL` points to a
  non-default artifact.
- `LYNX_CORE_JS_PATH` uses a local core script instead of the SDK core script
  or a download.
- `CUSTOM_LYNX_CORE_JS_URL` downloads a different core script.
- `CUSTOM_LYNX_CORE_JS_SHA256` is required when `CUSTOM_LYNX_CORE_JS_URL` points to a
  non-default artifact.
- `LYNX_SKIP_ADHOC_SIGN=1` skips ad-hoc signing on macOS.

## macOS signing

Cargo test binaries are not signed with Hardened Runtime or Library Validation,
so ordinary local tests do not need Developer ID signing.

On macOS, Cargo ad-hoc signs the downloaded runtime before building tests. To
refresh the downloaded artifact, remove the runtime library under
`target/lynx-engine-bridge-sdk/lib/` and rerun Cargo.

## Validation

Run CI-equivalent Rust checks from the repository root:

```sh
cargo fmt --check
cargo clippy --tests --all-features -- -D warnings
cargo llvm-cov nextest --all-targets --all-features --profile ci --config-file .cargo/nextest.toml --lcov --output-path lcov.info --release
```

For a focused local loop while editing this crate, run:

```sh
cargo test --locked -p lynx --all-targets --all-features
```

The runtime-backed tests use the runtime prepared by `build.rs`. If you have an
SDK already, set it directly:

```sh
LYNX_SDK_DIR=/path/to/lynx-sdk \
cargo test --locked -p lynx --all-targets --all-features
```

CI does not run a separate engine-bridge job. The crate is part of the root
Cargo workspace, so the main Rust workflow covers it through workspace-level
fmt, clippy, and test jobs. The Linux test job lets `build.rs` download the
Linux runtime artifact into `target/lynx-engine-bridge-sdk`, inject
`LYNX_SDK_DIR`, and run the runtime-backed tests with the rest of the workspace.
The Linux runtime also needs `libepoxy.so.0`; install the `libepoxy0` system
package before running runtime-backed tests locally on Linux. macOS uses the
same Rust code path and remains available for local development, but it is not
required as a PR check.

The `lynx/tests/runtime.rs` integration test belongs to the library crate. It
contains public API tests and runtime-backed tests. Runtime-backed tests fail
when no runtime is available, so keep `build.rs` and CI in sync.

## Troubleshooting

`libLynx_clay was not found`

Set `LYNX_LIB_PATH` to the exact runtime library path, or set `LYNX_SDK_DIR` to a
folder that contains the runtime in `lib/`.

`failed to load symbol lynx_*`

The runtime does not match the required public C API. Use an artifact built
against a compatible set of Lynx embedder headers. If a safe method instead
returns `UnsupportedRuntimeApi`, that method requires a newer additive runtime
API while the rest of the loaded runtime remains usable.

`libepoxy.so.0: cannot open shared object file`

Install the Linux runtime dependency with your system package manager. On Ubuntu
24.04, install `libepoxy0`.

Resource requests fail

Resource resolution is owned by the host-provided `GenericResourceFetcher`.
Check that your fetcher maps the runtime request URL to the resource bytes your
bundle expects.
