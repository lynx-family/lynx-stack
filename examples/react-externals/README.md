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

## Verify asynchronous snapshot registration on Lynx

The opt-in `COMP_LIB_MAIN_THREAD_DELAY_MS` diagnostic delays the component
library's main-thread `loadScript` evaluation after fetching succeeds. It logs
`renderPage` installation/calls, first-screen child count, and hydration patches.
The default demo is unchanged when this variable is absent.

After the normal install and full `pnpm turbo build`, build and serve native bundles:

```bash
PORT=3307 LYNX_HOST=127.0.0.1 COMP_LIB_MAIN_THREAD_DELAY_MS=2000 pnpm turbo build --filter @lynx-js/example-react-externals --only --force --env-mode=loose
PORT=3307 LYNX_HOST=127.0.0.1 pnpm --filter @lynx-js/example-react-externals preview
```

Forward port 3307 with ADB and open
`http://127.0.0.1:3307/main.lynx.bundle?fullscreen=true` in Lynx Explorer.
The native host supplies the early `renderPage` call; no simulated host delay
is needed. Check that component evaluation finishes before first-screen
handover, then tap the logo to verify a background update.

Verified with the official Lynx Explorer 4.2.0 on Android 16 ARM64: the early
native call waits for component evaluation, the first screen has two children,
the hydration patch is empty, and tapping the logo switches to the React logo.
Browser timing experiments live in
[`react-externals-web`](../react-externals-web/README.md#verify-asynchronous-snapshot-registration).
