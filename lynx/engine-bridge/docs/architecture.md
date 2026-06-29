# Engine bridge architecture

The engine bridge is a single Rust crate, `lynx`, layered over a runtime-loaded
`libLynx_clay` dynamic library. The crate keeps raw ABI access available while
giving embedders a smaller safe API for the headless path.

## Components

`lynx::sys` owns raw C ABI definitions and symbol loading. It contains the
checked-in structs, constants, callback types, and the `LoadedLibrary` table.
All direct function pointers live there.

`Env` owns a reference-counted `LoadedLibrary`. It is the entry point for
loading the runtime and for process-wide runtime settings such as ICU data,
DevTool, LogBox, and module registration.

`WindowlessRenderer` wraps Lynx renderer callbacks. It stores the Rust renderer
and host objects behind pointers registered with the C runtime. Callback
panics are caught before they cross the FFI boundary.

`GenericResourceFetcher` wraps resource callbacks. It converts Lynx resource
requests into Rust values and writes `FetchResponse` values back to the runtime.

`LynxGroup` wraps Lynx group ownership. The current safe API covers group
creation, group-thread toggling, and preload JavaScript paths so headless hosts
can provide runtime JavaScript explicitly when needed.

`HeadlessView` builds and owns a Lynx view. It binds the renderer, optional
resource fetcher, optional Lynx group, viewport metrics, ICU path, and module
registrations before creating the runtime view.

`examples/headless` shows how these pieces fit together in a non-windowed
process. It uses a software renderer and a folder-backed resource fetcher.

## Runtime loading flow

1. The caller sets `LYNX_LIB_PATH` or `LYNX_SDK_DIR`.
2. `Env::load()` asks `lynx::sys` for candidate runtime paths.
3. `LoadedLibrary` opens the first loadable dynamic library.
4. `LoadedLibrary` resolves all required `lynx_*` and `lynx_rust_*` symbols.
5. Safe wrappers keep an `Arc<LoadedLibrary>` so function pointers remain valid
   while wrappers created from the environment are alive.

No Rust crate in this workspace links `libLynx_clay` at build time.

## Ownership model

Runtime objects are released through RAII wrappers:

- `WindowlessRenderer` calls `lynx_windowless_renderer_release`.
- `GenericResourceFetcher` calls `lynx_generic_resource_fetcher_release`.
- `LynxGroup` calls `lynx_group_release`.
- `HeadlessView` calls `lynx_view_release`.
- internal template and meta objects release themselves after load/update calls.

Callback contexts are stored in process-local maps keyed by runtime pointers.
The runtime finalizer callbacks remove those entries and drop the boxed Rust
state. This avoids passing borrowed Rust references through the C ABI.

## Error boundaries

The safe API returns `Result<T, lynx::Error>` for operations that can fail before
control enters the runtime, such as:

- invalid C strings
- missing or unloadable runtime libraries
- missing required symbols
- null pointers returned by runtime constructors
- local I/O in the headless example

Runtime callbacks catch Rust panics with `catch_unwind` and translate them into
failure values that the C ABI can handle. Panics must not cross FFI boundaries.

## CI coverage

The Rust CI job validates two paths:

- ordinary Rust checks that do not need a runtime
- runtime loading on macOS with a downloaded `libLynx_clay.dylib`

The runtime-loading test only runs the real loader when `LYNX_LIB_PATH` or
`LYNX_SDK_DIR` is set. This keeps local unit tests independent from binary
artifacts while still checking the downloaded dylib in CI.

The headless example has a deterministic PNG comparison test that stores its
reference image under `examples/headless/tests/fixtures/`. It validates the
screenshot writer and golden-update workflow without requiring a runtime
software-present callback.
