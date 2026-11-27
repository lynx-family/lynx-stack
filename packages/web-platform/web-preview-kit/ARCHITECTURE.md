# Architecture of the web preview

Two private packages build and preview ReactLynx cards in a browser.

- [`@lynx-js/web-bundle-kit`](../web-bundle-kit) compiles a project that lives in memory into Lynx web bundles. It knows nothing about previews; its contract is [`src/types.ts`](../web-bundle-kit/src/types.ts).
- `@lynx-js/web-preview-kit` is a page that fills its iframe with the previewed card. An embedding application drives it over `postMessage` and builds its own UI around the iframe.

```
embedding application
│  window.postMessage handshake, then a MessagePort     (src/protocol.ts)
▼
kit page (iframe or top-level page, cross-origin isolated)
├─ session         answers requests, sends events, owns revisions and the card
├─ <lynx-view>     renders the previewed card with web-core
├─ bundler worker  runs web-bundle-kit; writes each build's assets to CacheStorage
└─ service worker  serves <scope>__lynx_preview__/<instance>/<asset> from CacheStorage
```

## Components

**Session** (`src/page/index.ts`, `src/page/session.ts`). The page posts `ready` to its parent, accepts one `connect` from its parent with a `MessagePort`, and answers requests on that port one after another. When the page is the top-level page, its parent is itself, so only its own scripts can connect; the end-to-end tests drive it this way.

**Bundler worker** (`src/worker/`). A module Worker that imports the bundle kit at run time from `bundle-kit/`, a copy of the bundle kit's `dist/` made by the kit's build. The copy is neither bundled again nor minified: the bundle kit loads its chunks, Rspack's wasm and its package mirror from next to its entry, and its plugins stringify runtime functions whose text must not change. The worker writes the assets of every build to CacheStorage and only then reports the build. A build carries the newest file system revision the bundler had when the build started, so it covers every change it includes.

**Serving builds** (`src/sw/service-worker.ts`). Cards load their bundle, hot updates, chunks and static assets by URL, some with synchronous XHR from a worker. The Service Worker answers those URLs from CacheStorage, ignoring the query. CacheStorage survives a Service Worker that the browser stops. The instance id in the URLs keeps the previews of several pages on one origin apart; a page deletes its cache when it is hidden. The cache keeps what the latest build needs:

- the hot-update files of the latest build; older ones are deleted;
- a copy of the card bundles of the latest successful build under `.cards/`, because a failed build rewrites the card bundles. Cards load from that copy.

**Hot updates** (`src/page/cardView.ts`). After a successful rebuild the page sends the dev-server messages `hash` and `ok` to the card with `lynxView.sendDevtoolEvent`. The card's HMR client fetches the update from the Service Worker and applies it. A card that cannot apply an update calls `NativeModules.LynxDevToolSetModule.invokeCdp` with `Page.reload`; the kit provides that module through `nativeModulesMap` and loads the card again. Every load uses a new URL, because web-core caches a decoded template by its URL.

**Failed builds.** The running card is left as it is, and the embedder gets the errors in `build.done`. The first successful build after a failed one loads the card again instead of hot-updating it: on web, an update chain through a failed build leaves the card's main thread stale.

## Deployment requirements

- Every response of the kit has `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: cross-origin`.
- The page must be cross-origin isolated. `Document-Isolation-Policy: isolate-and-require-corp` on the page does that as a top-level page and in any iframe (Chromium). Without it, the embedder must be cross-origin isolated and give the iframe `allow="cross-origin-isolated"`.
- The iframe must keep its own origin (`sandbox`, if any, has `allow-scripts allow-same-origin`): the kit needs a Service Worker and CacheStorage.
- Serve `.wasm` as `application/wasm`.

When the page is not cross-origin isolated or cannot register its Service Worker, requests fail with the underlying error.

`scripts/serve.mjs` serves `dist/kit` with these headers.

## Known limits

- Edits to main-thread-only code are not hot-updated on web; reload the card.
- CSS of async chunks and lazy bundles is not hot-updated on web.
- A card that misses a hot update, because a later build finished before it fetched the update, is loaded again.
- The cache of a page that is killed before `pagehide` stays in CacheStorage.
- After a forced reload (Shift + reload) the Service Worker does not control the page, and the page answers no request. Reload it normally.
