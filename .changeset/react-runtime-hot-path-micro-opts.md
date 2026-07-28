---
"@lynx-js/react": patch
---

Optimize runtime hot paths: hydrate now takes a pairwise fast path when children match by type (skipping diff bookkeeping allocations), snapshot tree traversal no longer materializes child arrays, and per-element work in first-screen rendering, background commits and main-thread hooks allocates less.
