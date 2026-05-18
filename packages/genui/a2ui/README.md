# @lynx-js/a2ui-reactlynx

ReactLynx renderer for the A2UI v0.9 protocol. **Headless** — the package
ships no styles or chrome; consumers wrap surfaces themselves.

This package includes:

- `<A2UI>`: all-in-one component that owns a `MessageProcessor`,
  subscribes to a developer-supplied `MessageStore`, and renders the
  most recent surface.
- `MessageStore`: an append-only buffer of raw protocol messages the
  developer pushes into from any IO transport (fetch, SSE, WebSocket,
  in-process mock, …).
- `defineCatalog` / `mergeCatalogs` / `serializeCatalog`: the pluggable
  catalog API. No global registry — every consumer composes the set of
  components they want available.
- `catalog/<Name>`: built-in component renderers (`Text`, `Button`,
  `Card`, `Column`, `Row`, `List`, `CheckBox`, `RadioGroup`, `Image`,
  `Divider`, `Icon`, `Modal`, `Tabs`).
- `catalog/<Name>/catalog.json`: per-component JSON-Schema manifests
  for the agent handshake.

## Exports

- `@lynx-js/a2ui-reactlynx`: `<A2UI>`, `createMessageStore`,
  `defineCatalog`, the built-ins, plus protocol types.
- `@lynx-js/a2ui-reactlynx/catalog`: re-exports of the catalog API and
  built-ins for tree-shake-friendly subpath access.
- `@lynx-js/a2ui-reactlynx/catalog/<Name>`: import a single built-in.
- `@lynx-js/a2ui-reactlynx/catalog/<Name>/catalog.json`: import the
  per-component manifest.
- `@lynx-js/a2ui-reactlynx/store`: `MessageStore`, `MessageProcessor`,
  `Resource`, payload normalizers — the pure data layer.
- `@lynx-js/a2ui-reactlynx/react`: lower-level renderer pieces for
  consumers that want manual surface lifecycle control.

## Installation

Make sure your app provides the peer dependencies:

- `@lynx-js/react`

## Quick Start

1. Create a `MessageStore`.
2. Wire your IO module (mock / SSE / fetch / …) to push raw protocol
   messages into the store.
3. Render `<A2UI messageStore={store} catalogs={[...]}>`.

```tsx
import {
  A2UI,
  Button,
  Text,
  createMessageStore,
} from '@lynx-js/a2ui-reactlynx';

const store = createMessageStore();

// Your IO module pushes raw v0.9 protocol messages into the store.
// async function streamFromAgent(input: string) {
//   for await (const msg of myAgent.stream(input)) store.push(msg);
// }

export function A2UIScreen(): import('@lynx-js/react').ReactNode {
  return (
    <A2UI
      messageStore={store}
      catalogs={[Text, Button]}
      className='surface-container'
      onAction={(action) => {
        // Forward to your agent — push the response messages back into
        // the same store. Fire-and-forget; the renderer never awaits.
      }}
      wrapSurface={(c) => <view className='luna-light'>{c}</view>}
    />
  );
}
```

The `<A2UI>` component is intentionally minimal:

- It owns its own `MessageProcessor` per mount; passing a different
  `messageStore` instance does **not** reset internal state — use a
  `key` prop derived from your turn/session id when you want a fresh
  session.
- `onAction` is fire-and-forget. The renderer doesn't wait for a
  response — your agent pushes follow-up messages back into the same
  `messageStore`.
- `className` applies to the surface root view (`surface-${surfaceId}`).
- `wrapSurface` applies an outer wrapper around the rendered surface.
- Both can be used for multi-theme switching; choose the layer that
  matches your styling strategy.

## Catalogs

The package intentionally **does not** ship an "all-in-one" aggregate.
Composition is per-component so bundlers can tree-shake what isn't
referenced.

### Bare components (renderer-only)

```ts
import { defineCatalog, Text, Button } from '@lynx-js/a2ui-reactlynx';

const catalog = defineCatalog([Text, Button]);
```

The protocol name comes from `displayName ?? component.name`.

> ⚠️ Production minifiers rewrite `function` names. For production
> safety, set an explicit `displayName` on every custom component, or
> pair it with its `catalog.json` manifest (the manifest key is
> authoritative).

### Paired with manifests (renderer + agent handshake)

```ts
import { Text, defineCatalog } from '@lynx-js/a2ui-reactlynx';
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

See [`src/catalog/README.md`](src/catalog/README.md) for the full
recipe (including the paste-able "every built-in" snippet).

## Custom Components

Any function returning a `ReactNode` works. The function's name (or
`displayName`) is the protocol name the agent will use:

```tsx
function MyChart(props: { data: number[] }) { ... }
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} ... />;
// Agent emits `{ component: 'MyChart', data: [...] }` → renders MyChart.
```

If you want schema introspection for a custom component, generate the
manifest with `@lynx-js/a2ui-catalog-extractor` against your interface
and pair it with the component the same way as the built-ins.
