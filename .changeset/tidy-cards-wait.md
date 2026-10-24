---
'@lynx-js/web-core': patch
---

Wait for the entry bundle's background scripts to be registered before starting the background runtime. This prevents external or lazy bundles that load first from triggering premature requests for unregistered entry modules.
