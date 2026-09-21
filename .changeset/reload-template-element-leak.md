---
"@lynx-js/react": patch
---

Release the tree a `reloadTemplate` replaces. Both the Snapshot and the Element
Template runtime left the previous tree linked parent-to-child, so it stayed a
reference cycle holding live elements. A tracing GC frees it eventually,
reference counting never does, so under `disableQuickTracingGC` every reload
leaked a generation of elements.
