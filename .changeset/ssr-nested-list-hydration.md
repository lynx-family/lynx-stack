---
"@lynx-js/react": patch
---

Fix SSR hydration of list snapshots with surrounding elements so list callbacks and recycling state are restored on the list element while preserving the snapshot root.
