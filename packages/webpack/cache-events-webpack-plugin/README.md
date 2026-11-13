<h2 align="center">@lynx-js/cache-events-webpack-plugin</h2>

A webpack plugin that caches Lynx native calls that arrive before an entry finishes starting up — on the background thread, and on the main thread for entries that start up asynchronously — and replays them once startup settles.

During asynchronous main-thread startup, registering a real `renderPage` handler
does not end caching. The startup proxy stays installed until the entry and its
asynchronous dependencies settle, then restores the latest registered handler
before replaying cached calls. This prevents first-screen handover while a
component external's snapshot definitions are still loading.
