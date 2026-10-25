---
applyTo: "packages/rspeedy/core/{src/cli/**,test/cli/**}"
---

Rspeedy CLI engine commands must await shared encode-worker shutdown before exit-hook flushes stdio. Worker pipe listeners can cross the default listener threshold without duplicate exit hooks; measure their origins rather than raising listener limits or suppressing warnings. Keep cleanup lazy for help/version, preserve warm workers during rebuilds, and verify real workers started and terminated in subprocess regression tests. Guard preload observers with isMainThread because worker threads inherit Node execArgv.
