---
applyTo: "packages/react/runtime/src/{shared,snapshot}/**/*profile*.ts"
---

Keep large Snapshot hook-state array profiling bounded while constructing detail;
do not stringify or enumerate the complete array and truncate afterward. Preserve
the existing detail schema for smaller arrays, ordinary objects, primitives,
class state, and Element Template profiling. Large array value records state
only the original length and that element detail is omitted. Array key and
shallow-diff records must state the omitted index count and that the tail was
not inspected.
