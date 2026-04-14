---
"@lynx-js/web-core": patch
---

fix(web-platform): completely detach event listeners and forcefully free `MainThreadWasmContext` pointer alongside strict FIFO async component disposal to ensure total memory reclamation without use-after-free risks
