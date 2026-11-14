# @lynx-js/example-react-externals-web

The web counterpart of [`react-externals`](../react-externals/README.md): the same
ReactLynx app, rendered **in a browser** through [`@lynx-js/web-core`](../../packages/web-platform/web-core),
with the ReactLynx runtime and the component library loaded as **asynchronous,
web-encoded external bundles**.

This example shows:

- Building the built-in ReactLynx runtime (`@lynx-js/react-umd`) and a component
  library as web `.web.bundle` files (decodable by `@lynx-js/web-core`).
- Wiring them as **async** externals — the web runtime can only load external
  bundles asynchronously (`fetchBundle().then`), so ReactLynx is mounted as a
  promise that consuming modules await before reading a subpath (otherwise
  `React.memo` and friends are read off a pending promise and are `undefined`).

## Usage

```bash
pnpm dev       # builds the bundles, then serves at http://localhost:3000 and opens it
```

Tap the logo — the tap handler runs on the background thread and swaps the logo,
exercising the full dual-thread ReactLynx model in the browser.

```bash
pnpm build     # just build the bundles (comp-lib + app)
pnpm preview   # serve an existing build without opening a browser
```

## How it works

- `rslib-comp-lib.config.ts` builds `comp-lib.web.bundle` with
  `defineExternalBundleRslibConfig({ ... }, { target: 'web' })`, keeping ReactLynx
  external via `externalsPresets: { reactlynx: { async: true } }`.
- `rsbuild.config.ts` builds the app for the `web` environment, loading ReactLynx
  (`reactlynx: { async: true }`) and the component library (`comp-lib.web.bundle`)
  as async externals.
- `web/index.ts` is the browser host: it imports `@lynx-js/web-core/client` (which
  registers `<lynx-view>`) and mounts a `<lynx-view>` pointing at `main.web.bundle`.
- `rsbuild.config.ts` serves the built `dist/*.web.bundle` files (via `publicDir`)
  next to the host page.

## Verify asynchronous snapshot registration

The opt-in `COMP_LIB_MAIN_THREAD_DELAY_MS` diagnostic delays the component
library's main-thread evaluation after fetching succeeds. It shares the timing
instrumentation with the native example, but uses this demo's web-encoded bundles.
Without the variable, the default demo is unchanged.

Complete the normal install and full `pnpm turbo build` first. The runner uses
Chromium from the existing web-core-e2e Playwright dependency:

```bash
pnpm --filter @lynx-js/web-core-e2e exec playwright install chromium
export PORT=3307 COMP_LIB_MAIN_THREAD_DELAY_MS=2000
```

Control: the host calls the cached `renderPage` before ReactLynx initializes:

```bash
HOST_RENDER_PAGE_DELAY_MS=0 pnpm turbo build --filter @lynx-js/example-react-externals-web --only --force --env-mode=loose
node examples/react-externals-web/scripts/snapshot-race.mjs
```

Regression: delay the host call until after ReactLynx registers `renderPage`,
while the component library is still pending:

```bash
HOST_RENDER_PAGE_DELAY_MS=100 pnpm turbo build --filter @lynx-js/example-react-externals-web --only --force --env-mode=loose
node examples/react-externals-web/scripts/snapshot-race.mjs
```

Both cases must render after component evaluation, hand over a nonempty first
screen, and produce no snapshot errors. The runner does not create patches or
invoke hydration itself. Against the unfixed runtime, set
`EXPECT_SNAPSHOT_ERROR=true` when running the script: it expects an empty first
screen, an `isHydration: true` patch, and `Snapshot not found`.

`SERVE_ONLY=true` starts only the diagnostic static server. This is a browser
simulation of the host ordering; native Explorer verification lives in
[`react-externals`](../react-externals/README.md#verify-asynchronous-snapshot-registration-on-lynx).
