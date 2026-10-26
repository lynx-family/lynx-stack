---
applyTo: "packages/rspeedy/core/{src/cli/**,test/cli/**}"
---

Rspeedy CLI engine commands must await shared encode-worker shutdown before exit-hook flushes stdio. Worker pipe listeners can cross the default listener threshold without duplicate exit hooks; measure their origins rather than raising listener limits or suppressing warnings. Keep cleanup lazy for help/version, preserve warm workers during rebuilds, and verify real workers started and terminated in subprocess regression tests. Guard preload observers with isMainThread because worker threads inherit Node execArgv.

Cover both idle-pool and actual-encode shutdown. A bare-JavaScript Rspeedy build can create workers without completing an encode task. For actual-encode coverage, configure the real LynxTemplatePlugin and LynxEncodePlugin, require a nonempty emitted native bundle, and assert pool.completed increased; worker construction alone does not prove encoding. Tinypool's completed counter also counts failed tasks, so it needs a successful build/output precondition.
