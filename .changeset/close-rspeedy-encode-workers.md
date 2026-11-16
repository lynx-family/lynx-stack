---
"@lynx-js/rspeedy": patch
---

Await shared encode-worker shutdown before the CLI flushes standard output and error. Worker pipe listeners can otherwise trigger `MaxListenersExceededWarning` during successful builds. Keep workers warm across rebuilds and avoid loading the engine for help/version commands.
