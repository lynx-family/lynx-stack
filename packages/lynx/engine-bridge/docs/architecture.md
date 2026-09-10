# Engine bridge architecture

The engine bridge contains one library crate, `lynx`, which is a member of the
repository Cargo workspace. The crate exposes an rlib for embedding a prebuilt
Lynx runtime from Rust. It does not contain a CLI or runnable example binary.

The Rust code does not link `libLynx_clay` at build time. `lynx::LynxEnv`
initializes the process-wide runtime with `libloading`, resolves the required C
ABI symbols, and shares those function pointers with the safe wrappers that
create a Lynx view.

## Code map

`lynx/src/sys` is the raw ABI layer. The complete Lynx `public/capi/*.h` tree is
the ABI source of truth because the view, builder, renderer, resource, metadata,
and DevTools contracts live in separate headers. `bindings.rs` contains the
checked-in C types, constants, and callback signatures. `loader.rs` owns
dynamic library discovery, dynamic loading, and the capability-focused
`LoadedLibrary` symbol table.

`lynx/src/env.rs` is the runtime entry point. `LynxEnv::load()` reads
`LYNX_LIB_PATH` or `LYNX_SDK_DIR`, initializes exactly one process-wide
environment, and exposes runtime settings such as ICU data, DevTool, LogBox,
and module registration. The singleton value is `!Send + Sync`; callers share
its `'static` reference instead of creating or moving environment values.

`lynx/src/renderer.rs` wraps the windowless renderer API. It supports software,
GL, GL-direct, and accelerated renderers. It also exposes host task callbacks,
input events, and the optional process-global UI task runner.

`lynx/src/resource.rs` wraps generic resource loading. It converts C resource
requests into `ResourceRequest` values and writes `FetchResponse` data back to
the runtime.

`lynx/src/group.rs` wraps `LynxGroup`, including preload JavaScript paths and
the JavaScript group-thread toggle.

`lynx/src/view.rs` creates and owns the view. `HeadlessViewBuilder`
binds the renderer, optional resource fetcher, optional group, viewport metrics,
ICU path, JavaScript runtime setting, and module registrations before it calls
`lynx_view_create`.
`LynxView` loads templates, updates data, sends global events, forwards
viewport changes, and enters foreground or background state.

`tools/runtime_build.rs` is included by package `build.rs` files. It prepares
the configured or downloaded runtime and core script, verifies both downloads,
and emits the environment variables that tests use. The core script is a build
artifact rather than a checked-in runner fixture.

## Runtime loading workflow

1. The caller sets `LYNX_LIB_PATH` to a runtime library or `LYNX_SDK_DIR` to an
   SDK folder. When `LYNX_CORE_JS_PATH` is not set, package `build.rs` files use
   `$LYNX_SDK_DIR/resources/lynx_core.js`, downloading it there when it is
   missing and automatic downloads are enabled. Without an explicit SDK,
   supported targets use `target/lynx-engine-bridge-sdk`. Cargo injects both
   `LYNX_SDK_DIR` and the resolved `LYNX_CORE_JS_PATH` automatically.
2. `LynxEnv::load()` asks `sys::candidate_library_paths()` for the configured
   runtime path.
3. `LoadedLibrary::load()` opens that dynamic library with `libloading`.
4. `LoadedLibrary::from_dynamic_library()` eagerly resolves the public
   `lynx_*` symbols needed by implemented bridge capabilities. It does not
   mechanically import every service and subsystem declared by the SDK.
   Newer additive symbols remain optional when the repository's default
   runtime does not export them, so unrelated capabilities can still load.
   C++ reference parameters in the public headers are represented as pointers
   in the Rust ABI.
5. Safe wrappers clone `Arc<LoadedLibrary>` so the dynamic library stays loaded
   while any object created from the environment is alive.

No crate in this workspace links `libLynx_clay` at compile time. Runtime-backed
tests still require a loadable dynamic library; local Cargo builds and CI use
`build.rs` to prepare that artifact before tests run.

## Embedding workflow

1. The host obtains the process-wide `LynxEnv` and configures runtime settings
   such as ICU data when needed.
2. The host creates a `WindowlessRenderer` and registers callbacks for the
   renderer mode it needs.
3. The host creates a `GenericResourceFetcher` when the bundle needs runtime
   resource requests to resolve through Rust.
4. The host optionally creates a `LynxGroup` and configures preload JavaScript
   paths or group-thread behavior.
5. The host builds `LynxView` with viewport metrics and loads template bytes
   through `load_template_bundle_bytes_with_global_props()` or related methods.
6. The host drives renderer tasks, UI tasks, input events, and lifecycle methods
   according to its embedding environment.

The library intentionally stops at these embedding primitives. CLI argument
parsing, filesystem-backed fetchers, screenshot writing, and application-level
event loops belong to the host or to a separate example workspace.

## Headless capture and DevTools

The downstream headless runner composes the bridge's existing capabilities. It
creates a software `WindowlessRenderer`, installs a `GenericResourceFetcher`,
loads templates through the metadata APIs, pumps UI tasks, and copies presented
RGBA frames for screenshots. Its DevTools connection supplies DOM inspection
and interaction for page automation. UI Judge uses that runner rather than
calling the raw C ABI directly.

These page-capture and DevTools paths remain part of the exercised bridge
surface. Do not remove their builder, renderer, resource, metadata, environment,
or view imports because one individual CAPI header looks narrower; verify them
against the complete `public/capi/*.h` set.

## Ownership and error boundaries

Runtime objects are owned by RAII wrappers:

- `WindowlessRenderer` calls `lynx_windowless_renderer_release`.
- `GenericResourceFetcher` calls `lynx_generic_resource_fetcher_release`.
- `LynxGroup` calls `lynx_group_release`.
- `LynxView` calls `lynx_view_release`.
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

The crate is a root Cargo workspace member and follows the main Rust workflow.
CI does not run a separate engine-bridge job. The workspace-level Rust jobs run:

```sh
cargo fmt --check
cargo clippy --tests --all-features -- -D warnings
cargo llvm-cov nextest --all-targets --all-features --profile ci --config-file .cargo/nextest.toml --lcov --output-path lcov.info --release
```

The Linux test job installs `libepoxy0`, lets package `build.rs` files download
`libLynx_clay.so` and `lynx_core.js` into
`target/lynx-engine-bridge-sdk`, injects their paths, and runs the
engine-bridge runtime tests with the rest of the workspace.
Runtime-backed tests fail when no runtime is available. This keeps local and CI
coverage aligned with the real downloaded runtime instead of passing through
silent skips.
