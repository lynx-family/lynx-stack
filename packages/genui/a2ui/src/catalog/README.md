# Catalog composition

The package intentionally **does not** ship an "all-in-one" catalog
constant. A top-level array referencing every built-in defeats
tree-shaking — every consumer of such an aggregate would bundle every
component, even the components you don't use. Composition is per-component,
and the cost is visible at the import site.

## The minimum a renderer needs

If your app only renders, names alone are enough. Pass bare components —
the protocol name comes from `displayName ?? component.name`.

> ⚠️ **Production minifiers will rename function declarations**, which breaks
> the `component.name` fallback. For production safety, set an explicit
> `displayName` on every custom component (the string literal survives
> minification), or pair the component with its `catalog.json` manifest
> using the tuple form below — the manifest key is authoritative.

```tsx
import { A2UI, Text, Button, createMessageStore } from '@lynx-js/genui/a2ui';

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
import { Text } from '@lynx-js/genui/a2ui/catalog/Text';
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

The protocol name lives in the JSON as the top-level key, so the runtime
never duplicates it.

## "I really want every built-in" - the paste-able recipe

This includes every built-in component and the A2UI v0.9 basic-catalog
function entries. The package intentionally does not export this as
`catalog/all`; keep the list at the integration site so the bundle cost stays
visible.

```tsx
import {
  basicFunctions,
  defineCatalog,
  Button,
  Card,
  CheckBox,
  ChoicePicker,
  DateTimeInput,
  Column,
  Divider,
  Icon,
  Image,
  LineChart,
  PieChart,
  List,
  Modal,
  RadioGroup,
  Row,
  Slider,
  Tabs,
  Text,
  TextField,
} from '@lynx-js/genui/a2ui';
import buttonManifest from '@lynx-js/genui/a2ui/catalog/Button/catalog.json' with {
  type: 'json',
};
import cardManifest from '@lynx-js/genui/a2ui/catalog/Card/catalog.json' with {
  type: 'json',
};
import checkBoxManifest from '@lynx-js/genui/a2ui/catalog/CheckBox/catalog.json' with {
  type: 'json',
};
import choicePickerManifest from '@lynx-js/genui/a2ui/catalog/ChoicePicker/catalog.json' with {
  type: 'json',
};
import dateTimeInputManifest from '@lynx-js/genui/a2ui/catalog/DateTimeInput/catalog.json' with {
  type: 'json',
};
import columnManifest from '@lynx-js/genui/a2ui/catalog/Column/catalog.json' with {
  type: 'json',
};
import dividerManifest from '@lynx-js/genui/a2ui/catalog/Divider/catalog.json' with {
  type: 'json',
};
import iconManifest from '@lynx-js/genui/a2ui/catalog/Icon/catalog.json' with {
  type: 'json',
};
import imageManifest from '@lynx-js/genui/a2ui/catalog/Image/catalog.json' with {
  type: 'json',
};
import lineChartManifest from '@lynx-js/genui/a2ui/catalog/LineChart/catalog.json' with {
  type: 'json',
};
import pieChartManifest from '@lynx-js/genui/a2ui/catalog/PieChart/catalog.json' with {
  type: 'json',
};
import listManifest from '@lynx-js/genui/a2ui/catalog/List/catalog.json' with {
  type: 'json',
};
import modalManifest from '@lynx-js/genui/a2ui/catalog/Modal/catalog.json' with {
  type: 'json',
};
import radioGroupManifest from '@lynx-js/genui/a2ui/catalog/RadioGroup/catalog.json' with {
  type: 'json',
};
import rowManifest from '@lynx-js/genui/a2ui/catalog/Row/catalog.json' with {
  type: 'json',
};
import sliderManifest from '@lynx-js/genui/a2ui/catalog/Slider/catalog.json' with {
  type: 'json',
};
import tabsManifest from '@lynx-js/genui/a2ui/catalog/Tabs/catalog.json' with {
  type: 'json',
};
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json' with {
  type: 'json',
};
import textFieldManifest from '@lynx-js/genui/a2ui/catalog/TextField/catalog.json' with {
  type: 'json',
};

export const allBuiltins = defineCatalog([
  [Text, textManifest],
  [Image, imageManifest],
  [Row, rowManifest],
  [Column, columnManifest],
  [List, listManifest],
  [Card, cardManifest],
  [Modal, modalManifest],
  [Button, buttonManifest],
  [Divider, dividerManifest],
  [LineChart, lineChartManifest],
  [PieChart, pieChartManifest],
  [TextField, textFieldManifest],
  [CheckBox, checkBoxManifest],
  [ChoicePicker, choicePickerManifest],
  [DateTimeInput, dateTimeInputManifest],
  [Icon, iconManifest],
  [RadioGroup, radioGroupManifest],
  [Slider, sliderManifest],
  [Tabs, tabsManifest],
  ...basicFunctions,
]);
```

Drop the `manifest` import + tuple form for any component whose schema you
don't need to ship to the agent. Keep `...basicFunctions` if your A2UI
messages use function calls in dynamic props, actions, or validation checks.

## Custom components

A component is anything that takes a single props object and returns a
ReactNode. The function's name (or `displayName`) is the protocol name the
agent will use:

```tsx
function MyChart(props: { data: number[] }) { ... }
// Required for production-safe naming — minifiers rewrite `function`
// names, but the `displayName` string literal survives.
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} ... />
// Agent sends `{ component: 'MyChart', data: [...] }` → renders MyChart.
```

If you want schema introspection for a custom component, generate the
manifest with `@lynx-js/genui/a2ui-catalog-extractor` against your interface and
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
