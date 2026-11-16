# ReactLynx loads a Lynx XML artifact

This native ReactLynx example mounts a `.lynxml` document in a fixed container.
It supports two delivery modes with the same lifecycle and background logic:
embedded custom sections in the host bundle (default), or an external XML bundle.
No Lynx SDK change or native module is required.

## Run

From the repository root, install and build the workspace as described in the
root `AGENTS.md`. Then run:

```sh
pnpm --filter @lynx-js/example-react-lynx-xml dev
```

Open the QR code in a LynxExplorer build with Lynx SDK 3.7 or newer (for
`__LoadStyleSheet`). Keep the development server reachable from the device. Set
`LYNX_HOST` to your computer's LAN IP if automatic address detection chooses the
wrong network interface; `PORT` defaults to `3000`. Tap **Mount XML card** to
initialize and display the XML card inside the outlined container.

For a local Android emulator, use the loopback address and forward the dev
server port to the emulator:

```sh
LYNX_HOST=127.0.0.1 pnpm --filter @lynx-js/example-react-lynx-xml dev
adb -s emulator-5554 reverse tcp:3000 tcp:3000
```

In LynxExplorer, enter `http://127.0.0.1:3000/main.lynx.bundle` as the Bundle
URL and tap **Go**, then tap **Mount XML card**.

To inspect production files:

```sh
pnpm turbo build --filter @lynx-js/example-react-lynx-xml
```

## Delivery modes

```sh
# Default: XML sections are stored inside main.lynx.bundle.
XML_BUNDLE_MODE=embedded pnpm --filter @lynx-js/example-react-lynx-xml dev

# External: also emit xml-card.lynx.bundle and fetch it on first mount.
XML_BUNDLE_MODE=external pnpm --filter @lynx-js/example-react-lynx-xml dev
```

Restart the dev server and reload the page when switching modes. Production
builds accept the same environment variable through `pnpm turbo build --filter @lynx-js/example-react-lynx-xml`. The example
Turbo configuration includes the mode and server address in the build cache key.

Both modes compile the same three sections: `xml-card/main`,
`xml-card/background`, and `xml-card/css`. In embedded mode, the plugin appends
these to the host's `beforeEncode` data without replacing ReactLynx's own scripts
or styles. No XML network request is needed; initialization is still deferred
until mount. The XML bytes contribute to the initial host download.

External mode emits those sections in `xml-card.lynx.bundle`. Serve both bundles
at the configured `assetPrefix`. The loader fetches it on each thread before
loading its sections, using the returned URL as the runtime bundle identity.
This mode keeps XML out of the initial host payload.

`__XML_SOURCE__` is build-time configuration, not an extra URL requirement:

```ts
const embeddedSource = { kind: 'embedded', sectionPrefix: 'xml-card' };
const externalSource = {
  kind: 'external',
  sectionPrefix: 'xml-card',
  url: 'https://host/xml-card.lynx.bundle',
};
```

The example selects one delivery mode per build. Both use the same parcel lifecycle.

## How it works

1. The [Lynx Parcels build plugin](../../packages/parcels) compiles the XML using
   `compileLynxXml` and writes the named sections into the selected bundle.
2. The React adapter starts background preparation with `runOnBackground` while
   loading the main-thread script and stylesheet independently. It returns
   `Promise<LoadedParcel<XmlCardData>>` as soon as the main thread can mount, without waiting for
   the background. Main resource failures reject this promise; background
   failures reject the separate `backgroundReady` promise and leave
   local rendering available. Keep the handle and both promises on the main thread.
3. The buttons change the `source` and `data` passed to `<ParcelView>`. The
   component mounts the XML, updates its data, and unmounts it when the source
   becomes `null`.
4. React owns the stable, empty `#xml-content` container; XML owns its children.
   The container's main-thread ref calls `unmount()` on detachment. Keep
   React-rendered children out of that container.

## XML lifecycle contract

```ts
interface XmlCardData {
  title: string;
  description: string;
  values?: number[];
}

interface XmlLifecycle {
  mount(containerSelector: string, initialData: XmlCardData): void;
  update(nextData: XmlCardData): void;
  unmount(): void;
}

interface LoadedXml extends XmlLifecycle {
  backgroundReady: Promise<void>;
}
```

All three methods are synchronous and main-thread-only. One loaded module
instance owns one mounted card. The container argument is a selector for an
existing native node, not a React ref or a cross-thread element handle.

| Method    | Contract                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mount`   | Resolve the container, create owned nodes, apply initial data, register page teardown, and flush. Repeating it on the same container calls `update`; switching containers requires `unmount` first. A missing or occupied container throws.             |
| `update`  | Apply a complete data snapshot to existing text nodes and flush. Node identity is preserved. Calling before mount or after unmount throws. `ParcelView` calls this when its data changes.                                                               |
| `unmount` | Remove only owned nodes, remove the instance's teardown listener, clear native references, and flush. Safe before mount and on repeated calls. The same instance can be mounted again. Future timers and event subscriptions must be released here too. |

The `title` and `description` fields are required strings; invalid data throws before changing the
current card. The stylesheet is adopted at page scope and remains available
across unmount/remount; this contract does not provide CSS isolation or unload
bundle resources. XML-native touch handlers are not demonstrated here; the host buttons drive
the lifecycle and background analysis. These interfaces do not provide general
interaction compatibility for arbitrary XML.

## Background logic and host adapter

`App.tsx` supplies card data and displays lifecycle notifications from
`ParcelView` in `@lynx-js/parcels/runtime/react`.

The XML's `<script thread="background">` owns a session per mounted card once ready. The
**Analyze data** button calls `update` with a `values` array. The background
script debounces requests, validates the values, sorts them, and computes sum,
mean, and median. The main thread only renders the result:

```text
App button → React state → ParcelView → XML main.update
  → getJSContext().dispatchEvent('XmlCard:command')
  → XML background: getCoreContext() listener → analyze
  → getCoreContext().dispatchEvent('XmlCard:result')
  → XML main: getJSContext() listener → update text nodes + flush
```

Before background readiness, mount and update render locally and retain only
the latest copied full data snapshot. The loader calls the XML module's internal
`setBackgroundReady()` once initialization completes. If still mounted, it sends
one `mount` command with the current instance ID, latest revision and data;
otherwise it creates no session. Later updates send commands normally. Unmount
clears pending data, so late readiness cannot resurrect an old mount. This
coalescing applies to full snapshots, not arbitrary click actions or delta commands.

Payloads contain only JSON data. Each command/reply includes the card instance
ID and revision, so stale replies cannot overwrite a later update or a new
mount. Unmount removes the main-thread result listener and sends a command that
cancels the background timer and deletes that session. One background command
dispatcher remains for the cached module's page lifetime to support remount.

`prepareParcelBackground` loads the background section explicitly in the background
runtime and reports readiness after registering its listener. Main rendering never
waits for that signal. `ParcelView` reports background readiness separately from mounting;
background failure does not remove the card. A failed initialization is removed
from the background cache, so a new loader can retry. The existing hook retains
its failed readiness promise; reload the page to retry in this demo.
Background exports and native element handles never cross threads. The plugin
wraps the background source using native `ReturnByFunction`/`tt.define` module
conventions. Storing a section does not execute it. Embedded mode uses the
current host bundle via the native `__Card__` identity; external mode first
fetches the requested bundle. Initialization sends an explicit ready/error event
back to the main thread, because `runOnBackground` does not await returned Promises. The
background cache includes both bundle identity and section prefix. Readiness
listeners are released on reply, main resource failure or page destruction;
unmount does not cancel resource preparation shared across subsequent mounts.

For standalone use, `__RenderPage` calls `mount` with default data and the page
root. The parcel wrapper marks embedded execution so the main script can leave
page lifecycle registration to the host.
Standalone mounting uses `XmlCard:probe` / `XmlCard:ready` to handle either
script startup order without blocking first render.

After the full workspace build, run the lifecycle contract tests:

```sh
node --test examples/react-lynx-xml/test/*.test.mjs
pnpm --filter @lynx-js/parcels test
```

These tests execute the actual XML script with a minimal Element PAPI host to
verify state transitions and node identity. Loader tests exercise both delivery
modes and the background readiness boundary.
