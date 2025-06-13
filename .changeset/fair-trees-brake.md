---
"@lynx-js/web-worker-runtime": patch
---

fix: The parameter config of loadCard needs to add updateData, otherwise some event binding will fail when enableJSDataProcessor is turned on.
