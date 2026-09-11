---
"@lynx-js/react": patch
---

Keep ordinary callback ref cleanup separate for each node binding. Sharing one callback between multiple nodes no longer cleans up another node's binding during attachment, replacement, or removal. Bindings retain their cleanup across hydration and keyed moves in both Snapshot and Element Template.
