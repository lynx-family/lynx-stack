---
"@lynx-js/react": patch
---

Optimize `componentAtIndex` by a few hundreds microseconds: avoiding manipulate `__pendingListUpdates` unless SnapshotInstance tree is changed
