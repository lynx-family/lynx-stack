# Engine bridge architecture

The engine bridge is a small Cargo workspace that embeds a prebuilt Lynx runtime
from Rust. It has one library crate, `lynx`, and one executable example,
`lynx-headless-example`.

The Rust code does not link `libLynx_clay` at build time. `lynx::Env` loads the
runtime with `dlopen`, resolves the C ABI symbols with `dlsym`, and shares those
function pointers with the safe wrappers that create a headless Lynx view.

## Code map

`lynx/src/sys` is the raw ABI layer. `bindings.rs` contains checked-in C types,
constants, and callback signatures. `loader.rs` owns dynamic library discovery,
`dlopen`, `dlsym`, and the `LoadedLibrary` symbol table.

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

`lynx/src/group.rs` wraps `LynxGroup`. The headless example uses it to preload
`lynx_core.js` when a full SDK path is available.

`lynx/src/view.rs` creates and owns the headless view. `HeadlessViewBuilder`
binds the renderer, optional resource fetcher, optional group, viewport metrics,
ICU path, and module registrations before it calls `lynx_view_create`.
`HeadlessView` loads templates, updates data, sends global events, and forwards
viewport changes.

`examples/headless` is the executable workflow. It wires a software renderer, a
folder-backed resource fetcher, and a `HeadlessView` together, then writes the
latest non-transparent software frame as a PNG.

## Runtime loading workflow

1. The caller sets `LYNX_LIB_PATH` to a runtime library or `LYNX_SDK_DIR` to an
   SDK folder. When running through Cargo on macOS, package `build.rs` files
   download the default runtime and inject `LYNX_SDK_DIR` automatically.
2. `Env::load()` asks `sys::candidate_library_paths()` for runtime paths.
3. `LoadedLibrary::load()` opens the first loadable dynamic library.
4. `LoadedLibrary::from_dynamic_library()` resolves every required `lynx_*` and
   `lynx_rust_*` symbol.
5. Safe wrappers clone `Arc<LoadedLibrary>` so the dynamic library stays loaded
   while any object created from the environment is alive.

No crate in this workspace links `libLynx_clay` at compile time. Runtime-backed
tests still require a loadable dynamic library; local Cargo builds and CI use
`build.rs` to prepare that artifact before tests execute.

## Headless rendering workflow

1. The example loads `Env` and configures ICU data from `LYNX_SDK_DIR` when the
   SDK contains it.
2. It creates a `WindowlessRenderer::software()` with a `FrameSink`. Each
   software present callback copies the current frame bytes into Rust-owned
   memory.
3. It creates a `DirectoryResourceFetcher` from every `--asset-root` and the
   bundle parent folder. The fetcher resolves `assets://`, `local://`,
   `file://`, and `file://lynx?` URLs to files under those roots.
4. It optionally creates a `LynxGroup` with preload JavaScript paths. When
   `LYNX_SDK_DIR` points at a full SDK, the example tries to discover
   `lynx_core.js`.
5. It builds `HeadlessView` with an `800x600` viewport and loads the bundle with
   `load_template_bundle_bytes_with_global_props()`.
6. It pumps renderer tasks and, when configured, the Rust global UI task queue
   until a non-transparent software frame arrives or the timeout expires.
7. It writes the captured RGBA frame to the requested screenshot path.

On macOS, real ReactLynx bundles should use `--native-ui-loop`. That lets the
runtime drive its Darwin/FML UI loop. The Rust queue-backed global UI runner is
kept for focused task-runner experiments, but it does not drive every actor used
by the GenUI React fixture.

## Screenshot test workflow

The screenshot test validates the real GenUI fixture output:

1. The test requires a runtime configuration. On macOS, `build.rs` downloads the
   default runtime and injects `LYNX_SDK_DIR`; otherwise the test fails instead
   of silently skipping.
2. It runs the checked-in compiled bundle at
   `packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle`.
3. It copies `examples/headless/tests/fixtures/LynxResources.bundle` beside the
   Cargo-built example binary. The macOS runtime resolves `lynx_core.js` through
   the process main bundle.
4. It launches `lynx-headless-example --native-ui-loop` with the bundle folder
   and `src/assets` as asset roots.
5. It decodes the rendered PNG and compares RGBA pixels with
   `packages/genui/ui-judge/tests/fixtures/react/main.lynx.snapshot.png`,
   allowing a small tolerance for runner-level antialiasing differences.

Set `LYNX_UPDATE_REFERENCES=1` when you intentionally update the reference
image. Rerun the same test without that environment variable before committing.

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
from runtime constructors, template-bundle decode errors, and local I/O errors
in the example.

Rust callbacks catch panics with `catch_unwind` before returning to C. Panics
must not cross FFI boundaries.

## CI coverage

The `Engine Bridge (macOS)` CI job lets `build.rs` download
`libLynx_clay.dylib` into `target/lynx-engine-bridge-sdk`, ad-hoc sign it,
inject `LYNX_SDK_DIR`, and runs:

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked --all-targets --all-features
```

Runtime-backed tests fail when no runtime is available. This keeps local and CI
coverage aligned with the real downloaded runtime instead of passing through
silent skips.
