---
"@lynx-js/react": patch
---

Bump `@lynx-js/internal-preact` from `10.28.4-dfff9aa` to `10.29.1-20260423030218-e604bd5`.

Includes a diff-time fix that baselines `__slotIndex` on freshly-created DOM nodes, preventing `insert()`'s slot-branch from firing spuriously on first placement and avoiding a stale `insertBefore` reference when a sibling detaches mid-diff.
