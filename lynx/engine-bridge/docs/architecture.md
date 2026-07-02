# Engine bridge architecture

The engine bridge contains one library crate, `lynx`, which is a member of the
repository Cargo workspace. The crate exposes an rlib for embedding a prebuilt
Lynx runtime from Rust. It does not contain a CLI or runnable example binary.

The Rust code does not link `libLynx_clay` at build time. `lynx::Env` loads the
runtime with `libloading`, resolves the required C ABI symbols, and shares those
function pointers with the safe wrappers that create a headless Lynx view.

## Code map

`lynx/src/sys` is the raw ABI layer. `bindings.rs` contains checked-in C types,
constants, and callback signatures. `loader.rs` owns dynamic library discovery,
dynamic loading, and the `LoadedLibrary` symbol table.

`lynx/src/env.rs` is the runtime entry point. `Env::load()` reads `LYNX_LIB_PATH`
or `LYNX_SDK_DIR`, creates a reference-counted `LoadedLibrary`, and exposes
process-wide runtime settings such as ICU data, DevTool, LogBox, and module
registration.

`lynx/src/renderer.rs` wraps the windowless renderer API. It supports software,
GL, GL-direct, and accelerated renderers. It also exposes host task callbacks,
input events, and the optional process-global UI task runner.

`lynx/src/resource.rs` wraps generic resource loading. It converts C resource
requests into `ResourceRequest` values and writes `FetchResponse` data back to
the runtime.

`lynx/src/group.rs` wraps `LynxGroup`, including preload JavaScript paths and
the JavaScript group-thread toggle.

`lynx/src/view.rs` creates and owns the headless view. `HeadlessViewBuilder`
binds the renderer, optional resource fetcher, optional group, viewport metrics,
ICU path, and module registrations before it calls `lynx_view_create`.
`HeadlessView` loads templates, updates data, sends global events, forwards
viewport changes, and enters foreground or background state.

`tools/runtime_build.rs` is included by package `build.rs` files. It prepares
the configured or downloaded runtime and emits the environment variables that
tests use.

## Runtime loading workflow

1. The caller sets `LYNX_LIB_PATH` to a runtime library or `LYNX_SDK_DIR` to an
   SDK folder. When running through Cargo on supported targets, package
   `build.rs` files download the default runtime and inject `LYNX_SDK_DIR`
   automatically.
2. `Env::load()` asks `sys::candidate_library_paths()` for the configured
   runtime path.
3. `LoadedLibrary::load()` opens that dynamic library with `libloading`.
4. `LoadedLibrary::from_dynamic_library()` resolves every required `lynx_*` and
   `lynx_rust_*` symbol.
5. Safe wrappers clone `Arc<LoadedLibrary>` so the dynamic library stays loaded
   while any object created from the environment is alive.

No crate in this workspace links `libLynx_clay` at compile time. Runtime-backed
tests still require a loadable dynamic library; local Cargo builds and CI use
`build.rs` to prepare that artifact before tests run.

## Embedding workflow

1. The host loads `Env` and configures runtime-wide settings such as ICU data
   when needed.
2. The host creates a `WindowlessRenderer` and registers callbacks for the
   renderer mode it needs.
3. The host creates a `GenericResourceFetcher` when the bundle needs runtime
   resource requests to resolve through Rust.
4. The host optionally creates a `LynxGroup` and configures preload JavaScript
   paths or group-thread behavior.
5. The host builds `HeadlessView` with viewport metrics and loads template bytes
   through `load_template_bundle_bytes_with_global_props()` or related methods.
6. The host drives renderer tasks, UI tasks, input events, and lifecycle methods
   according to its embedding environment.

The library intentionally stops at these embedding primitives. CLI argument
parsing, filesystem-backed fetchers, screenshot writing, and application-level
event loops belong to the host or to a separate example workspace.

## Ownership and error boundaries

Runtime objects are owned by RAII wrappers:

- `WindowlessRenderer` calls `lynx_windowless_renderer_release`.
- `GenericResourceFetcher` calls `lynx_generic_resource_fetcher_release`.
- `LynxGroup` calls `lynx_group_release`.
- `HeadlessView` calls `lynx_view_release`.
- internal template, bundle, load-meta, and update-meta wrappers release their
  raw runtime objects after load or update operations.

Callback contexts for renderers and resource fetchers are stored in
process-local maps keyed by runtime pointers. Runtime finalizer callbacks remove
those entries and drop the boxed Rust state. This keeps borrowed Rust references
out of the C ABI.

The safe API returns `Result<T, lynx::Error>` for failures that Rust can detect:
invalid C strings, missing runtime libraries, missing symbols, null pointers
from runtime constructors, and template-bundle decode errors.

Rust callbacks catch panics with `catch_unwind` before returning to C. Panics
must not cross FFI boundaries.

## CI coverage

The `Engine Bridge` CI job runs on Linux only. It lets `build.rs` download the
Linux `libLynx_clay.so` artifact into `target/lynx-engine-bridge-sdk`, inject
`LYNX_SDK_DIR`, and runs:

```sh
cargo fmt --package lynx --check
cargo clippy --locked -p lynx --all-targets --all-features -- -D warnings
cargo test --locked -p lynx --all-targets --all-features
```

Runtime-backed tests fail when no runtime is available. This keeps local and CI
coverage aligned with the real downloaded runtime instead of passing through
silent skips.
