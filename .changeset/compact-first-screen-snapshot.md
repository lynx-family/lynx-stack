---
"@lynx-js/react": patch
---

Compact the Snapshot first-screen handoff with a versioned tuple and type-dictionary representation, while keeping legacy payload hydration compatible.

Hydrate compact tuples directly on the background thread so large first-screen trees avoid reconstructing the previous serialized object graph.
