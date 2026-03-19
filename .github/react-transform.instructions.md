---
applyTo: "packages/react/transform/**/*"
---

When validating SWC transform snapshot changes, update the Rust fixtures with `UPDATE=1 cargo test -p swc_plugin_snapshot` and `UPDATE=1 cargo test -p swc_plugin_list --features napi` so the stored snapshots match the current transform output.
