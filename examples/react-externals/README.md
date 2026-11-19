# @lynx-js/example-react-externals

In this example, we show:

- Use `@lynx-js/lynx-bundle-rslib-config` to bundle a simple ReactLynx component library to a separate Lynx bundle.
- Use `@lynx-js/external-bundle-rsbuild-plugin` to load the built-in ReactLynx runtime bundle (sync) and component bundle (async).

## Usage

```bash
pnpm build:comp-lib
pnpm dev
```

The dev server will automatically serve the built-in ReactLynx runtime bundle and the component library bundle.

## Runtime URL

Run `pnpm dev`. The original `utils.js` keeps its `bundlePath` loading path
and logs the tap hint at startup. Click **Deliver URL and load message** to
provide the message URL and import the separate `message.lynx.bundle`.
Before the click, its resolver and fetch do not run. Repeated clicks reuse the
module. Both bundles are produced by the existing Rslib configuration.

The URL resolver runs in the consuming thread on first import. It must be a
standalone function without build-time closures. A string result supports either
loading mode; a Promise result requires asynchronous loading.
This demo uses the workspace plugin; no `runtime`, custom `load` or `lazy` option
is involved.

## Reproduce the snapshot startup race

Related fix: [PR #4350](https://github.com/lynx-family/lynx-stack/pull/4350).

```bash
REPRODUCE_STARTUP_RACE=true pnpm dev
```

Open the native bundle in Lynx Explorer. This opt-in case delays only the component library's main-thread execution by two seconds; it does not delay `renderPage`. Keep the default synchronous ReactLynx runtime (`REACTLYNX_ASYNC` unset). On an affected runtime, ReactLynx replaces the startup cache's `renderPage` before the component library is ready, hands over an empty first screen, and the background hydration patch reports `Snapshot not found`.

## Missing snapshot reproduction

For [#4348](https://github.com/lynx-family/lynx-stack/pull/4348), `App` imports a small
`BackgroundView` from a separate file and wraps it in `<background-only>`. The
main-thread first screen keeps the existing App content. Without the fix, the
background patch reports `Snapshot not found` because the component's snapshot
definition is missing from the main-thread library. Keep the component in a
separate file: defining it in `App.tsx` preserves its snapshot registration.
