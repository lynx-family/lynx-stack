---
"@lynx-js/react": patch
---

Bound Snapshot profiling detail for large hook-state arrays to their length,
plus key and shallow-diff information for the first 32 indices. Smaller arrays,
ordinary objects, primitives, class state, and Element Template profiling
retain their existing detail format.
