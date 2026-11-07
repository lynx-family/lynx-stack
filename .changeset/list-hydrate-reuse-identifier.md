---
'@lynx-js/react': patch
---

Fix recycled `<list-item>` elements retaining stale content after hydration when a nonempty `reuse-identifier` is set. Keep recycle-pool instance references up to date using the same snapshot type and reuse identifier as enqueue and display callbacks.
