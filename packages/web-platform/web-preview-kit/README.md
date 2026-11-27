# @lynx-js/web-preview-kit

A page that builds and previews ReactLynx cards in the browser. It fills its iframe with the previewed card; the embedding application drives it over `postMessage` and builds its own UI around it. The kit builds in a Worker with [`@lynx-js/web-bundle-kit`](../web-bundle-kit) and renders the card in a `<lynx-view>` with hot updates.

- [`PROTOCOL.md`](PROTOCOL.md) and [`src/protocol.ts`](src/protocol.ts): the protocol.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): the components and the deployment requirements.

## Build and serve

From the repository root:

```bash
pnpm turbo build --filter=@lynx-js/web-preview-kit
```

The task depends on `@lynx-js/web-bundle-kit#build`, and the bundle kit's `dist/` is one of its inputs. The output, `dist/kit/`, is the page to deploy: `index.html`, `sw.js` (the Service Worker), `bundler-worker.js`, and `bundle-kit/`, a copy of the bundle kit's `dist/` (about 50 MB).

```bash
pnpm run serve            # http://localhost:4210/, or: node scripts/serve.mjs <port>
```

## Embed

```html
<iframe src="https://preview.example.com/" allow="cross-origin-isolated"></iframe>
```

```js
window.addEventListener('message', (event) => {
  if (event.source !== iframe.contentWindow || event.data?.type !== 'ready') {
    return;
  }
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = (message) => console.log(message.data);
  iframe.contentWindow.postMessage(
    { channel: 'lynx-web-preview', type: 'connect' },
    'https://preview.example.com',
    [port2],
  );
  port1.postMessage({
    id: 1,
    method: 'project.open',
    params: { files, config: { entries: { main: 'src/index.tsx' } } },
  });
});
```

## Test

The tests are Playwright tests (Chromium) against the built kit and the real bundle kit. Build first (see above), then in this directory:

```bash
pnpm run test:e2e         # serves dist/kit on port 4211 and runs tests/e2e
pnpm run test:type
```

The tests open the kit as the top-level page. A helper installed in the page (`tests/e2e/harness.ts`) connects with `window.postMessage`, sends requests and records events in `window.kit`.

- `handshake.spec.ts`: `ready`, one `connect`, and another window that cannot connect.
- `preview.spec.ts`: one opened project shared by tests that run in order: the first build and card, CSS and TSX hot updates, an update the card cannot apply, a failed build and its fix, `preview.select`, `preview.reload`, `preview.setData`, `project.configure`, file and asset requests, a failing request, and `project.close`.

Every test page records V8 coverage (`tests/e2e/coverage.ts`). The scripts are mapped to `dist/kit` by URL and converted with `v8-to-istanbul` through their source maps; the sources under `src/` are written to `packages/web-platform/.nyc_output/`. Playwright does not measure workers, so `src/worker/` and `src/sw/` are not in the report.

```bash
pnpm run coverage         # text report
pnpm run coverage:ci      # packages/web-platform/coverage/lcov.info
```

CI runs the tests and `coverage:ci` in the `playwright-web-preview-kit` job of `.github/workflows/test.yml`.
