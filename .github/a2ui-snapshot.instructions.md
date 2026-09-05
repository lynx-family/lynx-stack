---
applyTo: "packages/genui/a2ui/src/snapshot/**,packages/genui/a2ui/test/**/*.test.ts"
---

For A2UI final-state compaction, model the message stream as an operation log and replay it into a dedicated snapshot state machine before serializing compact messages. Do not trim the original message array in place; update ordering, template expansion, data bindings, and deleted surfaces can make local pruning incorrect.
When adding snapshot-backed ReactLynx code generation, keep the generated TSX source derived from the same compaction path by default, and cover it with both source-shape tests and a gated Rspeedy + Kitten Lynx E2E fixture when device assertions are involved.
