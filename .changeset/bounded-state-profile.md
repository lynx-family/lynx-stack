---
"@lynx-js/react": patch
---

Keep Snapshot state-update traces independent of application state. The existing events retain component names, Hook indices, and flow IDs, but no longer include state values, property lists, or shallow diffs. Trace failures no longer interrupt pending Hook updates.
