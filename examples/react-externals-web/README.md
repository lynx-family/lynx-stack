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
- `lynx.config.ts` builds the app for the `web` environment, loading ReactLynx
  (`reactlynx: { async: true }`) and the component library (`comp-lib.web.bundle`)
  as async externals.
- `web/index.ts` is the browser host: it imports `@lynx-js/web-core/client` (which
  registers `<lynx-view>`) and mounts a `<lynx-view>` pointing at `main.web.bundle`.
- `rsbuild.config.ts` serves the built `dist/*.web.bundle` files (via `publicDir`)
  next to the host page.
