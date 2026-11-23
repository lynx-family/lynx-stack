---
"@lynx-js/genui": minor
---

Add `messageStore.replace(fullMessages)` for streams that end with a complete response. Reconcile final state while retaining unchanged components and local input on unchanged server fields, remove missing state, and continue consuming subsequent `push` calls. Replacement snapshots do not replay RPC calls or responses.

Rejected replacements report errors and leave the live state and consumption cursor unchanged; appended messages wait for a corrected replacement or a buffer clear. `MessageProcessor.replaceMessages` returns whether it accepted the snapshot. Fix messages being skipped when `clear()` and `push()` occur in the same batch.

Match array entries by unique `id` or `key` to preserve local edits through server insertions, deletions, and reordering. Arrays without usable identities merge by index when all three lengths agree; otherwise they use the server array. Recognize child references from catalog schemas or built-in child fields instead of treating every matching string as a component ID.

Use `replace([])` to clear rendered surfaces; `clear()` retains its buffer-only behavior. Preserve existing `push` lifecycle behavior: deleting the active surface leaves a blank renderer, and switching surfaces does not force a subtree remount.
