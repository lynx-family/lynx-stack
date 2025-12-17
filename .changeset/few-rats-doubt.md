---
"@lynx-js/web-explorer": patch
---

fix: web-explorer needs to actively send an iframeReady message to the parent, the parent uses `iframe load` listener cannot guarantee that the `message-listener` will complete execution.
