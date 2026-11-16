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

## Reproduce the snapshot startup race

Related fix: [PR #4350](https://github.com/lynx-family/lynx-stack/pull/4350).

```bash
REPRODUCE_STARTUP_RACE=true pnpm dev
```

Open the native bundle in Lynx Explorer. This opt-in case delays only the component library's main-thread execution by two seconds; it does not delay `renderPage`. Keep the default synchronous ReactLynx runtime (`REACTLYNX_ASYNC` unset). On an affected runtime, ReactLynx replaces the startup cache's `renderPage` before the component library is ready, hands over an empty first screen, and the background hydration patch reports `Snapshot not found`.
