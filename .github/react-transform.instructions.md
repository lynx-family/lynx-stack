---
applyTo: "packages/react/transform/**/*"
---

When validating SWC transform snapshot changes, update the Rust fixtures with `UPDATE=1 cargo test -p swc_plugin_snapshot` and `UPDATE=1 cargo test -p swc_plugin_list --features napi` so the stored snapshots match the current transform output.
When a crate exposes both core Rust structs and `napi` wrapper structs with the same semantic shape, keep internal transform pipelines and shared `Rc<RefCell<...>>` state on the core types and convert to the `napi` types only at the JS boundary. Do not mix `swc_plugin_*::napi::*` record types into internal plugin wiring such as `.with_*_records(...)`, or wasm builds can fail with mismatched type errors.
When recording source locations from SWC spans, guard `SourceMap::lookup_char_pos` for synthetic spans such as `DUMMY_SP` (`span.lo == 0`). Compat and other transforms may synthesize JSX nodes with default spans, and wasm builds can surface panics from source map lookups on those spans as `RuntimeError: unreachable`.
Expose recorded columns as 1-based values so `uiSourceMapRecords` can be fed directly into editor locations such as VS Code without an extra offset conversion.
When compat wraps a component with a synthetic `<view>`, preserve the original component spans on the generated wrapper instead of using `DUMMY_SP` or `Default::default()`. Snapshot ui source map extraction reads `opening.span`, so preserved spans keep `uiSourceMapRecords` file, line, and column data intact.
Keep `snapshot.filename` stable for snapshot hashing semantics, even when callers want absolute paths in exported debug metadata. If `uiSourceMapRecords.filename` needs to use the top-level transform filename, inject it at the `react/transform/src/lib.rs` boundary instead of changing the snapshot plugin's internal filename.
If `swc_plugin_snapshot::JSXTransformer::new` gains a new constructor parameter, update every external callsite under `packages/react/transform/**` at the same time, including wrapper crates such as `swc-plugin-reactlynx`, not just the main `packages/react/transform/src/lib.rs` entrypoint.
