# @lynx-js/web-preview-kit

A web page that builds and previews ReactLynx cards entirely in the browser. A host application (an editor, for example) embeds it in an iframe on its own origin, sends it a project over `postMessage`, edits files, and switches between cards; the kit builds in a Worker with [`@lynx-js/web-bundle-kit`](../web-bundle-kit) and renders the selected card in a `<lynx-view>` with hot updates.

- [`ARCHITECTURE.md`](ARCHITECTURE.md): the components and why.
- [`PROTOCOL.md`](PROTOCOL.md) and [`src/protocol.ts`](src/protocol.ts): the protocol a host speaks.
- [`src/client`](src/client/index.ts): a typed client for hosts, without runtime dependencies.

## Build

From the repository root:

```bash
pnpm turbo build --filter=@lynx-js/web-preview-kit
```

Use this command, without `--only`: the task depends on `@lynx-js/web-bundle-kit#build`, and the bundle kit's `dist/` is one of its inputs, so the kit always ships the current bundle kit and Turbo never restores an output built with another one.

The output is:

- `dist/kit/`: the page to deploy. `index.html`, `sw.js` (the Service Worker), `bundler-worker.js`, and `bundle-kit/`, a byte-for-byte copy of the `dist/` of `@lynx-js/web-bundle-kit` that the bundler worker imports at run time (about 50 MB; serve `.wasm` as `application/wasm`). The bundle kit is neither bundled again nor minified: it loads its own chunks, Rspack's wasm and its package mirror from next to its entry, and minifying it would rename the placeholders of the runtime templates its plugins stringify. When the bundle kit has no `dist/`, the build warns and leaves `bundle-kit/` out; the page then reports `supported: false` in `hello`.
- `dist/demo/`: the demo host.

## Serve

```bash
node scripts/serve.mjs            # kit on :4210, demo on :4211
```

Open `http://localhost:4211/index.html`. The script serves the kit with the headers of [Deployment requirements](ARCHITECTURE.md#deployment-requirements): `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Resource-Policy: cross-origin` on everything, and `Document-Isolation-Policy: isolate-and-require-corp` on the page. Query parameters of the demo:

- `isolated=1` makes the demo cross-origin isolated (COOP and COEP), the other way to isolate the iframe;
- `dip=0` drops `Document-Isolation-Policy` from the kit;
- `open=0` does not open the sample project;
- `kit=<url>` embeds a kit from elsewhere.

## Embed

```html
<iframe id="preview" src="https://preview.example.com/index.html" allow="cross-origin-isolated"></iframe>
```

```ts
import { connectPreview } from '@lynx-js/web-preview-kit/client';

const preview = await connectPreview(iframe, {
  origin: 'https://preview.example.com',
});
if (!preview.hello.supported) {
  console.warn(preview.hello.reason);
}
preview.on('build.done', ({ success, errors }) => {/* show diagnostics */});
await preview.open(files, {
  entries: { main: 'src/index.tsx', detail: 'src/detail.tsx' },
});
await preview.writeFile('src/App.css', css); // hot-updates the card
await preview.selectCard('detail');
```

The iframe must end up cross-origin isolated: either the host is isolated and the iframe has `allow="cross-origin-isolated"`, or the kit is served with `Document-Isolation-Policy` (Chromium). It must not be sandboxed without `allow-scripts allow-same-origin`.

## How it works

- `src/page/index.ts`: the handshake, the environment checks, the Service Worker registration (the page waits until it is controlled before creating any worker or `<lynx-view>`), the bundler worker and the session.
- `src/page/session.ts`: the state of a preview: revisions, build ids, the previewed card, and what follows a build (`preview.load`, `preview.hmr` or nothing).
- `src/page/router.ts`, `src/page/validate.ts`: parameter and path checks; requests are answered once each, in arrival order.
- `src/page/cardView.ts`: the `<lynx-view>`. Hot updates are the dev-server messages `hash` and `ok`, sent with `sendDevtoolEvent`; `NativeModules.LynxDevToolSetModule` is provided through `nativeModulesMap`, so the HMR client's `Page.reload` reaches the page.
- `src/worker/`: the bundler worker (`bundler-worker.ts`, logic in `host.ts`) and its messages with the page (`messages.ts`). It writes every build's emitted assets to CacheStorage before it reports the build, and labels a build with the newest revision handed to the bundler when the build starts, which covers every change the build includes, merged ones too.
- `src/sw/service-worker.ts`: serves `<scope>/__lynx_preview__/<instance>/<asset>` from the instance's cache, ignoring the query, and deletes the caches of pages that are gone.
- Cards load from a copy of their bundle made after each successful build (`<publicPath>.cards/<buildId>/`), because a failed build rewrites the bundles too. Hot-update files of the last five builds are kept.

## Test

Unit tests (rstest), from the repository root or this directory:

```bash
pnpm rstest --project web-platform/web-preview-kit
```

End-to-end tests (Playwright, Chromium; build the kit first):

```bash
pnpm exec playwright test                      # in this directory
PREVIEW_KIT_BUNDLER=real pnpm exec playwright test tests/e2e/hmr.spec.ts
```

- `tests/e2e/bundle-kit.spec.ts` runs the kit as shipped, with the real bundle kit and nothing substituted: open two cards, CSS and TSX hot updates, a syntax error and its recovery, switching cards, a third entry added with `project.configure`, and a production project with `build.getAsset`. It is skipped when the kit was built without the bundle kit.
- `tests/e2e/static.spec.ts` replaces the bundler worker with `tests/e2e/workers/static-worker.js`, which emits the fixture built in Node by `tests/node/build-fixture.mjs`. It covers the handshake in both isolation setups, `supported: false`, rendering from the Service Worker, `preview.select`, `preview.reload`, `preview.setData`, file requests, and a synchronous XHR from a module worker answered by the Service Worker.
- `tests/e2e/hmr.spec.ts` (hot-update edge cases: a module that declines updates, reload from the last good build after a failed one, and a `test.fail` for the stale main thread after a failed build) replaces the worker with `tests/e2e/workers/dev-worker.js`, which forwards to real Rsbuild watch compilations in Node (`tests/node/dev-service.mjs`), configured as the bundle kit configures a project (`tests/node/fixture-config.mjs`). With `PREVIEW_KIT_BUNDLER=real` it uses the kit's own worker and the bundle kit instead.

The test server swaps files by URL (`scripts/serve.mjs`, `kitOverrides`), so the shipped code has no test-only branch.
