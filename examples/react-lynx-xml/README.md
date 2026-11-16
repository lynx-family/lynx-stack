# Render a Lynx XML UI block in a ReactLynx host

This native ReactLynx example renders a `.lynxml` document in a fixed container.
It supports two output modes with the same lifecycle and background logic:
inline custom sections in the host bundle (default), or a remote XML bundle.
No Lynx SDK change or native module is required.

## Entry and ownership

The ReactLynx path is **hosted**: ReactLynx owns the existing Page, the empty container and the input props. Each XML renderer owns only its container's children and per-instance resources. It shares the host's main/background contexts and page-scoped styles.

The XML file also supplies an optional **standalone** page entry for direct preview in a container that supports Lynx XML. Only that entry may create a Page when one is absent; hosted rendering rejects a missing host Page. That entry may create a Page and uses the page render listener. It is independent from `inline` or `remote` delivery, and it is not a required Island capability or a public runtime mode.

| Delivery | Files                                                     | Rendering entry     |
| -------- | --------------------------------------------------------- | ------------------- |
| `inline` | `dist/inline/main.lynx.bundle` with XML sections included | Hosted in ReactLynx |
| `remote` | `dist/remote/main.lynx.bundle` and `xml-card.lynx.bundle` | Hosted in ReactLynx |

## Run

From the repository root, install and build the workspace as described in the
root `AGENTS.md`. Then run:

```sh
pnpm --filter @lynx-js/example-react-lynx-xml dev
```

Open the QR code in a LynxExplorer build with Lynx SDK 3.7 or newer (for
`__LoadStyleSheet`). Keep the development server reachable from the device. Set
`LYNX_HOST` to your computer's LAN IP if automatic address detection chooses the
wrong network interface; `PORT` defaults to `3000`. The initial module and props are present immediately: default inline delivery renders the XML card in the first frame. **Render XML card** recreates it after disposal.

For a local Android emulator, use the loopback address and forward the dev
server port to the emulator:

```sh
LYNX_HOST=127.0.0.1 pnpm --filter @lynx-js/example-react-lynx-xml dev
adb -s emulator-5554 reverse tcp:3000 tcp:3000
```

In LynxExplorer, enter `http://127.0.0.1:3000/main.lynx.bundle` as the Bundle
URL and tap **Go**. The inline card should already be present without tapping **Render XML card**.

To inspect production files:

```sh
pnpm turbo build --filter @lynx-js/example-react-lynx-xml
```

## Resource delivery

```sh
# Default inline delivery: no environment variable is required.
pnpm --filter @lynx-js/example-react-lynx-xml dev

# Optional remote delivery: emit xml-card.lynx.bundle and fetch it on first use.
XML_ISLAND_DELIVERY=remote pnpm --filter @lynx-js/example-react-lynx-xml dev
```

Omitting `XML_ISLAND_DELIVERY` selects `inline`; explicitly setting it to `inline` has the same effect. Remote delivery requires opting in with `remote`.

The previous example setting `XML_BUNDLE_MODE=embedded|external` is replaced by `XML_ISLAND_DELIVERY=inline|remote`; update local scripts accordingly.

Restart the dev server and reload the page when switching modes. Production
builds accept the same environment variable through `pnpm turbo build --filter @lynx-js/example-react-lynx-xml`. The example
Turbo configuration includes the mode and server address in the build cache key.

Both delivery choices expose the same three sections: `xml-card/main`,
`xml-card/background`, and `xml-card/css`. In inline mode, the plugin appends
these to the host's `beforeEncode` data without replacing ReactLynx's own scripts
or styles. No XML network request is needed; its main-thread script and CSS are evaluated synchronously when the container ref attaches. The XML bytes contribute to the initial host download.

Remote mode emits those sections in `xml-card.lynx.bundle`. Serve both bundles
at the configured `assetPrefix`. The loader fetches it on each thread before
loading its sections, using the returned URL as the runtime bundle identity.
This mode keeps XML out of the initial host payload.

`__XML_MODULE__` is build-time configuration, not an extra URL requirement:

```ts
const inlineModule = { expose: 'xml-card' };
const remoteModule = {
  expose: 'xml-card',
  entry: 'https://host/xml-card.lynx.bundle',
};
```

The example selects one delivery mode per build. Both render inside the ReactLynx host and use the same island lifecycle.

## How it works

1. The [Lynx Islands build plugin](../../packages/islands) parses XML with
   `parseLynxXML` from `@lynx-js/lynx-xml/parser`, converts its raw CSS to Lynx rules, and writes the named sections into the selected bundle.
2. For inline modules, the main-thread container ref reads its initial props, loads the host sections and creates the renderer synchronously before the first-frame flush. ReactLynx delays `runOnBackground` preparation/status calls until background hydration can receive them. The background effect then updates the same instance. For remote modules, the effect starts asynchronous bundle loading before creating the renderer. In both cases, background failures reject `backgroundReady` while local rendering remains usable. All module/instance handles and promises stay on the main thread.
3. The buttons change the `module` and `props` passed to `<Island>`. The
   component renders the XML, updates its data, and disposes it when the module
   becomes `null`.
4. React owns the stable, empty `#xml-content` container; XML owns its children.
   The container's main-thread ref calls `dispose()` on detachment. Keep
   React-rendered children out of that container.

## First-frame conditions

Default inline delivery is eligible for first-frame rendering when `module` and initial serializable props are present and the container is part of the first native tree. The example meets those conditions by initializing state with its card data. A module gated behind an interaction or background data request renders later. List items attach according to their native visibility lifecycle.

Remote delivery remains asynchronous, including cache hits. `ready` notifications run on the background thread and do not measure the native display time. Tests assert synchronous node creation before effects and preserve the renderer through actual worklet hydration; a screenshot taken after startup alone is insufficient proof of first-frame timing.

## XML lifecycle contract

```ts
interface XmlCardData {
  title: string;
  description: string;
  values?: number[];
}

interface XmlRenderer {
  render(containerSelector: string, initialData: XmlCardData): void;
  update(nextData: XmlCardData): void;
  dispose(): void;
}

interface XmlIslandModule {
  create(): XmlRenderer;
}

interface LoadedXmlIsland extends XmlIslandModule {
  backgroundReady: Promise<void>;
}
```

All three renderer methods are synchronous and main-thread-only. Hosted rendering rejects a missing host Page instead of creating one. One loaded module creates independent cards. The container argument is a selector for an
existing native node, not a React ref or a cross-thread element handle.

| Method    | Contract                                                                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render`  | Resolve the container, create owned nodes, apply initial data, register page teardown, and flush. Repeating it on the same container calls `update`; switching containers requires `dispose` first. A missing or occupied container throws.                                                                                   |
| `update`  | Apply a complete data snapshot to existing text nodes and flush. Node identity is preserved. Calling before render or after dispose throws. `Island` calls this when its data changes.                                                                                                                                        |
| `dispose` | Remove only owned nodes, remove the instance's teardown listener, clear native references, and flush. Safe before render and on repeated calls. The XML renderer can render again; a disposed host `IslandInstance` handle is final, so create a new handle. Future timers and event subscriptions must be released here too. |

The `title` and `description` fields are required strings; invalid data throws before changing the
current card. The stylesheet is adopted at page scope and remains available
across dispose/recreate; this contract does not provide CSS isolation or unload
bundle resources. XML-native touch handlers are not demonstrated here; the host buttons drive
the lifecycle and background analysis. These interfaces do not provide general
interaction compatibility for arbitrary XML.

## Background logic and host adapter

`App.tsx` supplies card data and displays lifecycle notifications from
`Island` in `@lynx-js/islands/react`.

The XML's `<script thread="background">` owns a session per rendered card once ready. The
**Analyze data** button calls `update` with a `values` array. The background
script debounces requests, validates the values, sorts them, and computes sum,
mean, and median. The main thread only renders the result:

```text
App button → React state → Island → XML main.update
  → getJSContext().dispatchEvent('XmlCard:command')
  → XML background: getCoreContext() listener → analyze
  → getCoreContext().dispatchEvent('XmlCard:result')
  → XML main: getJSContext() listener → update text nodes + flush
```

Before background readiness, render and update apply local UI changes and retain only
the latest copied full data snapshot. The instance controller calls its renderer's internal `setBackgroundReady()` once initialization completes. If still rendered, it sends
one initialization command with the current instance ID, latest revision and data;
otherwise it creates no session. Later updates send commands normally. Dispose
clears pending data, so late readiness cannot resurrect an old render. This
coalescing applies to full snapshots, not arbitrary click actions or delta commands.

Payloads contain only JSON data. Each command/reply includes the card instance
ID and revision, so stale replies cannot overwrite a later update or a new
render. Dispose removes the main-thread result listener and sends a command that
cancels the background timer and deletes that session. One background command dispatcher remains for the cached module's page lifetime to support rerender.

`prepareIslandBackground` loads the background section explicitly in the background
runtime and reports readiness after registering its listener. Main rendering never
waits for that signal. `Island` reports background readiness separately from rendering;
background failure does not remove the card. A failed initialization is removed
from the background cache, so a new loader can retry. The existing hook retains
its failed readiness promise; reload the page to retry in this demo.
Background exports and native element handles never cross threads. The plugin
wraps the background source using native `ReturnByFunction`/`tt.define` module
conventions. Storing a section does not execute it. Inline mode uses the
current host bundle via the native `__Card__` identity; remote mode first
fetches the requested bundle. Initialization sends an explicit ready/error event
back to the main thread, because `runOnBackground` does not await returned Promises. The
background cache includes both bundle identity and expose name. Readiness
listeners are released on reply, main resource failure or page destruction;
dispose does not cancel resource preparation shared across subsequent renders.

For the optional standalone entry, `__RenderPage` calls `renderStandalone`, which renders with default data and the page root. The island wrapper marks hosted execution so the main script can leave
page lifecycle registration to the host.
Standalone rendering uses `XmlCard:probe` / `XmlCard:ready` to handle either
script startup order without blocking first use.

After the full workspace build, run the lifecycle contract tests:

```sh
node --test examples/react-lynx-xml/test/*.test.mjs
pnpm --filter @lynx-js/islands test
```

These tests execute the actual XML script with a minimal Element PAPI host to
verify state transitions, host Page ownership, optional standalone startup, and node identity. Loader tests exercise both delivery modes and the background readiness boundary.
