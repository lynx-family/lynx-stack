---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-rpc": patch
"@lynx-js/web-constants": patch
---

fix: when a list-item is deleted from list, the deleted list-item is still showed incorrectly.

This is because the `enqueueComponent` method does not delete the node from the Element Tree. It is only to maintain the display node on RL, and lynx web needs to delete the dom additionally.
