# Render a Lynx XML UI block in a ReactLynx host

This native ReactLynx example renders a `.lynxml` document in a fixed container.
The Islands plugin includes the XML source in the host bundle.
No Lynx SDK change or native module is required.

An alternative `XML_RENDERER=frame` build loads the same raw `card.lynxml` through `<frame src>`, using the Explorer build that supports XML frame sources. This path creates an independent Lynx page; it requires native XML support and does not use the Islands build plugin. The default remains `XML_RENDERER=island` with inline delivery.

```sh
XML_RENDERER=frame pnpm turbo build --filter @lynx-js/example-react-lynx-xml
XML_RENDERER=frame pnpm --filter @lynx-js/example-react-lynx-xml dev
```

Frame defaults to synchronous loading with `card.lynxml?sync=true` as its `src`, using the specified Explorer build that supports this query. The query belongs to the child resource URL, not the parent bundle. Set `XML_FRAME_SYNC=false` to omit it for the standard frame path.

Sync frame output is in `dist/frame-sync/`; standard output is in `dist/frame/`. Both include the unmodified XML source copied alongside the host bundle. The host passes initial data and subsequent updates via `frame.data`; the XML standalone entry handles `__RenderPage` and `__UpdatePage`. Both modes use the same card, dimensions, initial props, and analysis button.

For measurement, set `XML_BENCHMARK=1` when building to omit the frame load callback's host status update. Analyze, Dispose, and Render actions still update the host status text in both modes. Use a single device and APK, alternate modes across repeated page opens, and separate initial native layout from the later background analysis result. Frame child metrics and parent metrics belong to distinct page instances.

See [the frame/inline performance comparison](./PERFORMANCE.md) for the measured results, exact APK, timing boundaries, and capture limitations.

Open [the standalone HTML summary](./performance.html) for a compact report. Its summary charts and trace evidence work offline.

The HTML report includes both rendering flows and interactive startup/update trace lanes for all three samples. Select a slice to inspect its identity and thread, or export the displayed evidence as JSON. Trace timestamps and PerformanceEntry timing use explicitly separate origins.

Memory is captured separately across three page lifecycles per mode. The report includes 38 global memory snapshots, instance breakdowns, and two complete memory-analysis reports that can be expanded or downloaded offline. Local disposal, remounting, and full-page exit are shown separately; collection warnings and GC coverage limitations remain visible.

To inspect the full original traces inside the report, start its local site:

```sh
pnpm --filter @lynx-js/example-react-lynx-xml report
```

Open `http://127.0.0.1:4175/performance.html`. `REPORT_PORT` can override the port. No application build is required for this static report.

The report embeds six startup/update `.pftrace` files and two memory lifecycle traces and opens them in an iframe. Official Perfetto is the default and requires network access; the optional Lynx viewer requires internal network access and SSO login. Choose inline/Frame, sample or memory lifecycle, and time range, or use a summary event's “在内嵌原始 Trace 中定位” button. A `PING`/`PONG` handshake sends the original bytes via `postMessage`, with `localOnly: true`; the report does not upload a trace or create a sharing URL. Its readiness handshake is not a trace-parsing acknowledgement, so the page reports “sent” and leaves actual parsing progress to the embedded UI.

The viewer may ask to trust a non-local report origin. Direct `file://` use may be restricted by the browser; HTTP hosting is recommended. A download button remains available without the viewer. The lightweight report server binds only to `127.0.0.1` and serves the report and its Markdown evidence, not the rest of the workspace.

## Use Islands

Register the XML source in the existing Rsbuild configuration:

```ts
import { pluginIslands } from '@lynx-js/islands/build';

export const islands = pluginIslands({
  exposes: { 'xml-card': 'xml/card.lynxml' },
});
```

Render it with the component:

```tsx
import { Island } from '@lynx-js/islands/react';

export function XmlCard({ title }: { title: string }) {
  return (
    <Island
      name='xml-card'
      className='XmlContainer'
      props={{ title, description: 'Rendered inside ReactLynx.' }}
    />
  );
}
```

The component generates its container ID and manages loading, updates, background initialization and disposal. Change `props` to update the card; conditionally unmount it to dispose it. No loader, readiness callback or native flush call is required in application code.

The source is included in the host bundle. The example writes the Island build to `dist/inline`; it does not emit a separate Island bundle or accept a delivery-mode switch. The optional `XML_RENDERER=frame` comparison still uses the raw XML source as a separate frame page.

## Run

Install and build the workspace following the root `AGENTS.md`, then start the example:

```sh
pnpm --filter @lynx-js/example-react-lynx-xml dev
```

Open the QR code in LynxExplorer with Lynx SDK 3.7 or newer. Set `LYNX_HOST` to a device-reachable address if automatic LAN detection is unsuitable; `PORT` defaults to `3000`.

For a local Android emulator:

```sh
LYNX_HOST=127.0.0.1 pnpm --filter @lynx-js/example-react-lynx-xml dev
adb -s emulator-5554 reverse tcp:3000 tcp:3000
```

Open `http://127.0.0.1:3000/main.lynx.bundle`. The XML card is present initially. The buttons update its data, remove it, and mount it again.

In the default Island mode, saving `xml/card.lynxml` recompiles the host bundle and automatically reloads the page through the Lynx dev transport. Script and style changes reset page state. Keep HMR or live reload enabled and use a container with DevTool reload support.

Build the example from the repository root:

```sh
pnpm turbo build --filter @lynx-js/example-react-lynx-xml
```

## First-frame behavior

An Island participates in the host's first frame when its component, container and initial props are present in the first render. Components gated behind an interaction or a background data request mount later. Background initialization does not block first-frame rendering.

ReactLynx owns the Page and the component's empty container; the XML renderer owns its children. The source's standalone entry is used only by the frame comparison. Styles share the host's page scope.

## Validation

After the full workspace build:

```sh
node --test examples/react-lynx-xml/test/*.test.mjs
pnpm --filter @lynx-js/islands test
```

The tests cover XML updates and cleanup, synchronous host-bundle loading, independent background readiness, and first-frame instance reuse through compiled worklet hydration.
