---
"@lynx-js/react": patch
---

Adapt Element Template List creation and updates to Native List rendering,
diffing, and node reuse. Store logical items in `childSlots[0]` and forward
item platform info through Element Template options and native updates.

Match hydrated List items by `item-key`, with FIFO template matching for
unkeyed items, and reuse generic child-slot insertion and removal commands.
