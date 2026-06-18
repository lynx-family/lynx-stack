---
applyTo: "packages/genui/a2ui/src/snapshot/**"
---

For A2UI final-state compaction, model the message stream as an operation log and replay it into a dedicated snapshot state machine before serializing compact messages. Do not trim the original message array in place; update ordering, template expansion, data bindings, and deleted surfaces can make local pruning incorrect.
