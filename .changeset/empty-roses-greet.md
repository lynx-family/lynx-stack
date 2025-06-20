---
"@lynx-js/react": patch
---

Fixed two memory leaks:

1. When JSX is rendered on the main thread and removed, FiberElement can still be referenced by `__root.__jsx` through `props.children`;

2. When the SnapshotInstance tree is removed from the root node, its child nodes form a cycle reference because the `__previousSibling` and `__nextSibling` properties point to each other, thus causing a FiberElement leak.
