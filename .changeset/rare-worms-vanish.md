---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Support caching Lynx native events when chunk splitting is enabled.

When `performance.chunkSplit.strategy` is not `all-in-one`, Lynx native events are cached until the BTS chunk is fully loaded and are replayed when that chunk is ready. The `firstScreenSyncTiming` flag will no longer change to `jsReady` anymore.
