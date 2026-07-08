---
"@lynx-js/cache-events-webpack-plugin": minor
---

Cache and replay native calls for async-external entries on both threads.

An async-external entry renders startup as a plain `__webpack_require__(entry)` that the event-caching runtime (keyed on `RuntimeGlobals.startup`) never hooked, so calls made while the external ReactLynx bundle was still loading were lost. The plugin now requires `startup` for such async entry chunks: the background thread caches the same `tt` / performance / `globalThis` events as the chunk-split path, and the main thread caches the first-screen `renderPage` and replays it once loaded so the page is not left blank.

`setupListTransformer` now receives a second `{ isMainThread }` argument (it runs once per thread), so custom cache events can be added to a single thread — e.g. `(setupList, { isMainThread }) => isMainThread ? setupList : [...setupList, myEvent]`. Existing single-argument transformers are unaffected.
