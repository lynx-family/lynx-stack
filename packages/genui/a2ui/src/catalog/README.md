# Catalog composition

The package intentionally **does not** ship an "all-in-one" catalog
constant. A top-level array referencing every built-in defeats
tree-shaking — every consumer of such an aggregate would bundle every
component, even the nine you don't use. Composition is per-component, and
the cost is visible at the import site.

## The minimum a renderer needs

If your app only renders, names alone are enough. Pass bare components —
the protocol name comes from `displayName ?? component.name`:

```tsx
import {
  A2UI,
  Text,
  Button,
  createMessageStore,
} from '@lynx-js/a2ui-reactlynx';

const store = createMessageStore();

// Push raw protocol messages from your IO module (fetch, SSE, ...).
// async function streamFromAgent(input) {
//   for await (const msg of myAgent.stream(input)) store.push(msg);
// }

<A2UI
  messageStore={store}
  catalogs={[Text, Button]}
  onAction={(action) => {
    /* forward to your agent and push response messages back */
  }}
/>;
```

Bundlers tree-shake unused components — pulling `Text` does not drag in
`Button`, `Card`, etc.

## Adding schemas for the agent handshake

If you want `serializeCatalog(...)` to emit JSON Schema for each component
(for the agent to know what props to send), pair each component with the
JSON the extractor emitted at `dist/catalog/<Name>/catalog.json`:

```tsx
import { Text } from '@lynx-js/a2ui-reactlynx/catalog/Text';
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

The protocol name lives in the JSON as the top-level key, so the runtime
never duplicates it.

## "I really want every built-in" — the paste-able recipe

```tsx
import {
  defineCatalog,
  Button,
  Card,
  CheckBox,
  Column,
  Divider,
  Image,
  List,
  RadioGroup,
  Row,
  Text,
} from '@lynx-js/a2ui-reactlynx';
import buttonManifest from '@lynx-js/a2ui-reactlynx/catalog/Button/catalog.json' with {
  type: 'json',
};
import cardManifest from '@lynx-js/a2ui-reactlynx/catalog/Card/catalog.json' with {
  type: 'json',
};
import checkBoxManifest from '@lynx-js/a2ui-reactlynx/catalog/CheckBox/catalog.json' with {
  type: 'json',
};
import columnManifest from '@lynx-js/a2ui-reactlynx/catalog/Column/catalog.json' with {
  type: 'json',
};
import dividerManifest from '@lynx-js/a2ui-reactlynx/catalog/Divider/catalog.json' with {
  type: 'json',
};
import imageManifest from '@lynx-js/a2ui-reactlynx/catalog/Image/catalog.json' with {
  type: 'json',
};
import listManifest from '@lynx-js/a2ui-reactlynx/catalog/List/catalog.json' with {
  type: 'json',
};
import radioGroupManifest from '@lynx-js/a2ui-reactlynx/catalog/RadioGroup/catalog.json' with {
  type: 'json',
};
import rowManifest from '@lynx-js/a2ui-reactlynx/catalog/Row/catalog.json' with {
  type: 'json',
};
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json' with {
  type: 'json',
};

export const allBuiltins = defineCatalog([
  [Text, textManifest],
  [Image, imageManifest],
  [Row, rowManifest],
  [Column, columnManifest],
  [List, listManifest],
  [Card, cardManifest],
  [Button, buttonManifest],
  [Divider, dividerManifest],
  [CheckBox, checkBoxManifest],
  [RadioGroup, radioGroupManifest],
]);
```

Drop the `manifest` import + tuple form for any component whose schema you
don't need to ship to the agent.

## Custom components

A component is anything that takes a single props object and returns a
ReactNode. The function's name (or `displayName`) is the protocol name the
agent will use:

```tsx
function MyChart(props: { data: number[] }) { ... }

<A2UI catalogs={[Text, Button, MyChart]} ... />
// Agent sends `{ component: 'MyChart', data: [...] }` → renders MyChart.
```

If you want schema introspection for a custom component, generate the
manifest with `@lynx-js/a2ui-catalog-extractor` against your interface and
pair it the same way:

```tsx
defineCatalog([[MyChart, myChartManifest]]);
```

## API surface

- `defineCatalog(inputs)` — builds the runtime catalog. Inputs can mix bare
  components, `[component, manifest]` tuples, and already-resolved entries
  (e.g. from `mergeCatalogs`).
- `mergeCatalogs(...catalogs)` — last-write-wins on duplicate names.
- `serializeCatalog(catalog)` — emits the JSON manifest for the agent
  handshake. Components without an attached schema serialize to `{ name }`
  only.
- `resolveCatalog(catalog)` — name → component map (used internally by the
  renderer; exposed for advanced cases).
