---
applyTo: "packages/react/transform/crates/swc_plugin_worklet/**"
---

When preserving MainThreadObject handles in captured worklet closures, test both direct captures and handles nested under ordinary objects, including class `this.props` captures. Evaluate each member-expression source once so getters and computed access cannot be repeated by the generated fallback.

Bundle comparisons for capture-transform changes must include an input that exercises the changed capture shape plus an unchanged control. Absolute bundle differences between separate worktrees may contain embedded-path noise, so attribute the transform cost from the affected-versus-control differential.
