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

## Verify asynchronous snapshot registration

The opt-in `COMP_LIB_MAIN_THREAD_DELAY_MS` diagnostic delays the component
library's main-thread `loadScript` evaluation after fetching succeeds. It logs
`renderPage` installation/calls, first-screen child count, and hydration patches.
The default demo is unchanged when this variable is absent.

For a browser experiment, first complete the repository's normal install and
`pnpm turbo build`. The runner uses Chromium from the existing web-core-e2e
Playwright dependency. Install that browser if necessary:

```bash
pnpm --filter @lynx-js/web-core-e2e exec playwright install chromium
export PORT=3307 LYNX_HOST=127.0.0.1 EXTERNAL_BUNDLE_TARGET=web COMP_LIB_MAIN_THREAD_DELAY_MS=2000
```

Control: async ReactLynx, with the host calling the cached `renderPage` before
the runtime loads. The component should render after the delay, without errors:

```bash
HOST_RENDER_PAGE_DELAY_MS=0 pnpm turbo build --filter @lynx-js/example-react-externals --only --force --env-mode=loose
REACTLYNX_ASYNC=true node examples/react-externals/scripts/snapshot-race.mjs
```

Regression: move the host's initial `renderPage` call to 100 ms, after ReactLynx has
registered the real function but before the component library executes. This
models the native host ordering when ReactLynx loads synchronously and a
component external loads asynchronously. It does not manually create patches
or invoke hydration:

```bash
HOST_RENDER_PAGE_DELAY_MS=100 pnpm turbo build --filter @lynx-js/example-react-externals --only --force --env-mode=loose
REACTLYNX_ASYNC=true node examples/react-externals/scripts/snapshot-race.mjs
```

Both cases must render successfully, hand over a nonempty first screen after
main-thread component evaluation, and produce no snapshot errors. On the
unfixed runtime, run with `EXPECT_SNAPSHOT_ERROR=true` instead: the runner checks
for an empty first screen, an `isHydration: true` patch, and `Snapshot not found`.
The timing mode is a Web simulation of the host ordering, not an Android reproduction.

`SERVE_ONLY=true` runs only the diagnostic static server. Omit
`EXTERNAL_BUNDLE_TARGET=web` when building native bundles. Stop the server before
running another experiment on the same port.

For native Explorer verification, use `PORT=3307 LYNX_HOST=127.0.0.1
COMP_LIB_MAIN_THREAD_DELAY_MS=2000 HOST_RENDER_PAGE_DELAY_MS=0` with the same
Turbo build command, then start the runner with `SERVE_ONLY=true` (without
`REACTLYNX_ASYNC`). Forward port 3307 with ADB and open
`http://127.0.0.1:3307/main.lynx.bundle?fullscreen=true` in Lynx Explorer.
The native host supplies the early `renderPage` call; no simulated host delay
is needed. Check that component evaluation finishes before first-screen
handover, then tap the logo to verify a background update.

Verified with the official Lynx Explorer 4.2.0 on Android 16 ARM64: the early
native call waits for component evaluation, the first screen has two children,
the hydration patch is empty, and tapping the logo switches to the React logo.
