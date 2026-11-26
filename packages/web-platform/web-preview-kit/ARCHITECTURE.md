# Architecture of the web preview

Two private packages build and preview ReactLynx cards entirely in a browser.

- `@lynx-js/web-bundle-kit` compiles a project that lives in memory into Lynx web bundles. It is the build engine and knows nothing about previews.
- `@lynx-js/web-preview-kit` is a web app. A host application (an editor, for example) embeds it in an iframe, sends it files with `postMessage`, and sees the cards render and hot-update. It depends on the bundle kit and on `@lynx-js/web-core`.

```
host application (any origin)
│  window.postMessage handshake, then a MessagePort     (src/protocol.ts)
▼
preview kit page (iframe, its own origin, cross-origin isolated)
├─ session        answers requests, sends events, owns revision and card state
├─ <lynx-view>    renders the selected card with web-core
├─ bundler worker runs web-bundle-kit; writes each build's assets to CacheStorage
└─ service worker serves `<scope>/__lynx_preview__/<instance>/<asset>` from CacheStorage
```

## web-bundle-kit

**What it is.** A browser build of Rsbuild with `pluginLynx` and `pluginReactLynx`, running on `@rspack/browser`. Its contract is [`src/types.ts`](../web-bundle-kit/src/types.ts): `createWebBundler(options)` returns a bundler with `applyChanges`, `build`, `watch` and `close`.

**Where it runs.** Inside a dedicated Worker of a cross-origin isolated page. `@rspack/browser` blocks its thread and needs `SharedArrayBuffer`.

**How Node.js code runs in a browser.** The kit's own build replaces Node.js built-ins with browser stand-ins. The rules:

- `fs` is the memfs of `@rspack/browser`, the same instance Rspack reads, so Rsbuild, the plugins and Rspack all see one file system.
- Packages that Rspack must read or resolve at build time are mirrored into memfs under `/node_modules`, at the paths the bundled code believes it runs from. This covers the runtime files injected into a card (the HMR client, the CSS and React Refresh runtimes, `@lynx-js/react`), and placeholders for the loaders. With the mirror in place, `require.resolve`, `path.resolve(__dirname, …)` and `fs.readFileSync` in the plugins work unchanged, because the stand-in for `createRequire` resolves against memfs.
- No path of the machine that built the kit may appear in its output.
- JavaScript loaders are bundled into the kit and handed to Rspack through `BrowserRequirePlugin`.

**What a project gets for free.** The mirror includes `@lynx-js/react` and what its output needs, so a project only supplies its own sources. A project can add dependencies by writing them under its own `node_modules/`.

**Development builds.** With `hmr` on, bundles contain the Lynx HMR client and Rspack emits hot-update files on every rebuild. The bundle kit does not deliver anything: its embedder serves the assets at `publicPath` and provides the two things a Lynx DevTool provides, update signals and full reload. `WebBundlerOptions.hmr` documents both.

## web-preview-kit

**Session.** The page announces itself to its parent, accepts one `connect` message carrying a `MessagePort`, and from then on speaks the protocol in [`src/protocol.ts`](src/protocol.ts) over that port. [`PROTOCOL.md`](PROTOCOL.md) explains it for host authors, and `src/client` is a small typed client a host can use instead of writing messages by hand.

**Bundler worker.** A module Worker next to the page imports the bundle kit at run time from `bundle-kit/`, a byte-for-byte copy of the bundle kit's `dist/` made by the kit's build. It is not bundled again: the bundle kit loads its own chunks, Rspack's wasm and its package mirror from next to its entry, and its plugins stringify runtime functions whose text must not change. Without that copy the page reports `supported: false`.

**Serving builds.** Cards load their bundle, hot updates, async chunks and static assets by URL, some of them with synchronous XHR from a worker. A Service Worker answers those URLs from CacheStorage:

1. After each build, the bundler worker writes the emitted assets into the cache of this preview instance and only then reports the build to the page.
2. The page reacts: it loads the card, or signals a hot update.

CacheStorage is used rather than memory in the Service Worker, because a Service Worker can be stopped at any time and would lose it. The instance id in the URL keeps two previews on one origin apart. Hot-update files of the last few builds are kept, since a card that missed an update asks for an older one before it falls back to a reload; the page, which sees every build, removes older ones. The Service Worker only serves, and removes the caches of pages that are gone.

**Hot updates.** After a successful rebuild the page sends the dev-server messages `hash` and `ok` to the running card through `lynxView.sendDevtoolEvent`. The card's HMR client fetches the update from the Service Worker and applies it: JavaScript through Rspack's HMR runtime and React Refresh, CSS through web-core's `replaceStyleSheetByIdWithBase64`. If the card cannot apply an update it asks for a reload through `NativeModules.LynxDevToolSetModule`, which the kit provides, and the page loads the card again.

A reload always uses a new URL, because web-core caches a decoded template by its URL.

**Cards.** Every entry of the project is a card. One card is previewed at a time; `preview.select` swaps the `<lynx-view>` URL to another card's bundle from the latest successful build. All cards are rebuilt on every change, so switching is immediate. A failed build rewrites the card bundles too, so after each successful build the page copies them to `.cards/<buildId>/` under the public path and cards load from that copy.

**Failed builds.** The running card is left as it is. The host gets the errors in `build.done` and decides how to show them. The first successful build after a failed one loads the card again (`hmr-fallback`) instead of hot-updating it: on web, an update chain through a failed build leaves the main thread stale.

## Deployment requirements

- The kit must be served with `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: cross-origin`.
- The iframe must end up cross-origin isolated. Either the embedding page is itself cross-origin isolated and the iframe has `allow="cross-origin-isolated"`, or the kit is served with `Document-Isolation-Policy: isolate-and-require-corp` (Chromium only), which isolates the iframe under any embedder.
- The iframe must not be sandboxed without `allow-scripts allow-same-origin`: the kit needs its own origin for the Service Worker and CacheStorage.
- When the requirements are not met, the kit still connects and reports `supported: false` with the reason in its `hello` event.

## Known limits

- Edits to main-thread-only code (main-thread functions) are not hot-updated on web; reload the card.
- CSS of async chunks and lazy bundles is not hot-updated on web.
- Console output of a card is not forwarded to the host.
- Recovering from a failed build reloads the card, which loses its state.
