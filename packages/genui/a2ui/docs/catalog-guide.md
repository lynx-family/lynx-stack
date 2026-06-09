# Catalogs, built-ins, and custom components

A **catalog** is the contract between your Agent and your client: it lists
the components the renderer is allowed to instantiate and the functions it
can execute, and it carries the optional JSON schemas an Agent reads during
a handshake. This guide covers everything about composing that contract —
from the one-line minimum, through the built-in component set, to shipping
your own components and generating their schemas.

If you only skim one section, make it [The built-in components](#the-built-in-components) and [Basic-catalog functions](#basic-catalog-functions): those are the vocabulary your Agent
gets to work with.

## What a catalog is

A catalog has two kinds of entries:

- **Components** — map a protocol name (`"Text"`, `"Card"`, your
  `"MyChart"`) to a ReactLynx component the client renders.
- **Functions** — map a protocol function name (`"formatDate"`,
  `"required"`) to a client-side implementation the renderer calls while
  resolving props, actions, and validation checks.

You build one with `defineCatalog`, then either pass it (or a raw input
array) to `<A2UI catalogs={…}>` for rendering, or run it through
`serializeCatalog` to announce the contract to your Agent.

A component's **protocol name** comes from `displayName ?? component.name`,
unless you pair it with a manifest — in which case the manifest's top-level
key is authoritative. The name is the only thing the Agent references, so
keeping it stable matters (see the minifier warning below).

## Start small: renderer-only components

If your app only needs to render, pass bare components. No schemas, no
ceremony.

```ts
import { defineCatalog, Text, Button } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([Text, Button]);
```

You can pass the same array straight to `<A2UI>` without calling
`defineCatalog` yourself — the component composes it internally:

```tsx
<A2UI messageStore={store} catalogs={[Text, Button]} onAction={…} />;
```

Bundlers tree-shake unused components: pulling in `Text` does **not** drag
`Button`, `Card`, or any other built-in into your bundle.

> ⚠️ **Production minifiers rename function declarations**, which breaks the
> `component.name` fallback. For production safety, either set an explicit
> `displayName` on every custom component (the string literal survives
> minification) or pair the component with its `catalog.json` manifest using
> the tuple form — the manifest key is authoritative and immune to
> minification.

## The built-in components

The package ships 20 A2UI v0.9 basic-catalog renderers. Each is an
independent, tree-shakeable export, available from the root or from
`@lynx-js/genui/a2ui/catalog/<Name>`.

**Layout and containers**

| Component | What it renders                                                    |
| --------- | ------------------------------------------------------------------ |
| `Row`     | A horizontal layout container for a `children` list.               |
| `Column`  | A vertical layout container for a `children` list.                 |
| `Card`    | A padded, elevated surface that wraps a single `child`.            |
| `List`    | A scrollable collection — the usual target for templated children. |
| `Tabs`    | Tabbed sections that switch between child views.                   |
| `Modal`   | An overlay/dialog surface layered above the rest of the UI.        |
| `Divider` | A thin separator rule between items.                               |

**Content**

| Component | What it renders                                                |
| --------- | -------------------------------------------------------------- |
| `Text`    | A string of text, with a `variant` such as `body` for styling. |
| `Image`   | An image from a source URL.                                    |
| `Icon`    | A named icon glyph.                                            |

**Input and actions**

| Component       | What it renders                                   |
| --------------- | ------------------------------------------------- |
| `Button`        | A tappable button that dispatches a user action.  |
| `TextField`     | A single-line text input bound to the data model. |
| `CheckBox`      | A boolean toggle.                                 |
| `RadioGroup`    | A single-choice set of radio options.             |
| `ChoicePicker`  | A picker/select for choosing among options.       |
| `Slider`        | A numeric value selected along a range.           |
| `DateTimeInput` | A date and/or time input.                         |

**Data visualization**

| Component   | What it renders                            |
| ----------- | ------------------------------------------ |
| `LineChart` | A line chart over a series of data points. |
| `PieChart`  | A pie chart over a set of values.          |

**Feedback**

| Component | What it renders                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------- |
| `Loading` | A loading indicator. Also the default `renderFallback` for `<A2UI>` while a surface is pending. |

To learn the exact props each one accepts, read its manifest at
`@lynx-js/genui/a2ui/catalog/<Name>/catalog.json` — that JSON is the same
schema the Agent sees.

## Adding manifests for Agent handshakes

If you want `serializeCatalog(...)` to emit JSON Schema for each component
(so the Agent knows which props to send), pair each component with the JSON
generated at `dist/catalog/<Name>/catalog.json` using the tuple form:

```ts
import { Text, defineCatalog, serializeCatalog } from '@lynx-js/genui/a2ui';
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

The protocol name lives in the JSON as the top-level key, so the runtime
never duplicates it. Components you register without a manifest still
render fine — they just serialize to `{ name }` only, which tells the Agent
the component exists without describing its props.

## Basic-catalog functions

A2UI messages can embed function calls in dynamic props, action payloads,
and validation checks — for example `{ call: 'formatDate', args: { … } }`.
These run **on the client at render time**. To make them available, spread
`...basicFunctions` into the same catalog input list:

```ts
import { Text, basicFunctions, defineCatalog } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([Text, ...basicFunctions]);
```

`basicFunctions` is an array of ready-made entries whose implementations
come straight from the upstream `@a2ui/web_core` basic catalog, so the wire
contract stays aligned with the A2UI v0.9 spec for free. It covers 25
functions:

| Category   | Functions (protocol names)                                                  |
| ---------- | --------------------------------------------------------------------------- |
| Arithmetic | `add`, `subtract`, `multiply`, `divide`                                     |
| Comparison | `equals`, `not_equals`, `greater_than`, `less_than`                         |
| Logic      | `and`, `or`, `not`                                                          |
| Text       | `contains`, `starts_with`, `ends_with`, `length`                            |
| Validation | `required`, `regex`, `numeric`, `email`                                     |
| Formatting | `formatString`, `formatNumber`, `formatCurrency`, `formatDate`, `pluralize` |
| Action     | `openUrl`                                                                   |

> Note the mixed casing — comparison/text helpers use `snake_case`
> (`not_equals`, `starts_with`) while formatters use `camelCase`
> (`formatDate`, `openUrl`). These are the upstream A2UI v0.9 names; use
> them verbatim in messages.

Include `...basicFunctions` whenever your Agent might emit any of these. If
a message references a function the catalog does not contain, that call
resolves to `undefined` rather than throwing.

If you build your own renderer instead of using `<A2UI>`, call
`registerBasicFunctions()` once to register the same implementations into
the shared `functionRegistry`.

## Why there is no `catalog/all`

The package intentionally does **not** ship an "all-in-one" catalog
constant or a `@lynx-js/genui/a2ui/catalog/all` export. A single top-level
array referencing every built-in would defeat tree-shaking — every consumer
of that aggregate would bundle every component, even the ones they never
render. Composition is per-component, and the bundle cost stays visible at
the import site.

## The paste-able "every built-in" recipe

When you genuinely want all of them, keep the list at the integration site.
This composes every built-in component with its manifest, plus the basic
functions:

```tsx
import {
  basicFunctions,
  defineCatalog,
  Button,
  Card,
  CheckBox,
  ChoicePicker,
  Column,
  DateTimeInput,
  Divider,
  Icon,
  Image,
  LineChart,
  List,
  Loading,
  Modal,
  PieChart,
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
import columnManifest from '@lynx-js/genui/a2ui/catalog/Column/catalog.json' with {
  type: 'json',
};
import dateTimeInputManifest from '@lynx-js/genui/a2ui/catalog/DateTimeInput/catalog.json' with {
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
import listManifest from '@lynx-js/genui/a2ui/catalog/List/catalog.json' with {
  type: 'json',
};
import loadingManifest from '@lynx-js/genui/a2ui/catalog/Loading/catalog.json' with {
  type: 'json',
};
import modalManifest from '@lynx-js/genui/a2ui/catalog/Modal/catalog.json' with {
  type: 'json',
};
import pieChartManifest from '@lynx-js/genui/a2ui/catalog/PieChart/catalog.json' with {
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
  [Loading, loadingManifest],
  ...basicFunctions,
]);
```

Drop the manifest import and tuple form for any component whose schema you
do not need to send to the Agent — `defineCatalog([Text, Button])` is
perfectly valid. Keep `...basicFunctions` if your messages use function
calls.

## Custom components

A catalog component is _anything_ that takes a single props object and
returns a `ReactNode`. Its function name — or its `displayName` — is the
protocol name the Agent will use:

```tsx
function MyChart(props: { data: number[] }) { /* … */ }
// Required for production-safe naming: minifiers rewrite `function` names,
// but the `displayName` string literal survives.
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} … />;
// Agent emits `{ component: 'MyChart', data: [...] }` → renders MyChart.
```

Custom components receive runtime-shaped props from the protocol stream. For
anything beyond a leaf component, reach into `@lynx-js/genui/a2ui/react`,
the contract custom components plug into:

- **`useDataBinding`** — resolve a bound value (`{ path }`) against the
  surface's data model and get a setter back, so inputs can write user edits
  into the model.
- **`useResolvedProps`** — resolve a whole prop bag at once, expanding data
  bindings and function calls into concrete values.
- **`useAction`** — turn a protocol action into a `sendAction` callback you
  fire on tap/submit; the result loops back out through `<A2UI onAction>`.
- **`useChecks`** — evaluate validation checks (built from basic functions
  like `required`/`email`) and report pass/fail with messages.
- **`NodeRenderer`** — render child component ids against the same surface,
  the same way the built-ins render their children.

## Generating a manifest for a custom component

If the Agent needs to know a custom component's props, generate a manifest
and pair it the same way you would a built-in.

1. Describe the props as a TypeScript `interface` and annotate it with the
   `@a2uiCatalog <ComponentName>` JSDoc tag so the extractor picks it up.
2. Run the public CLI to emit the JSON:

   ```bash
   npx @lynx-js/genui a2ui generate catalog --catalog-dir src/catalog --out-dir dist
   ```

3. Pair the generated JSON with the component:

   ```tsx
   import myChartManifest from './dist/catalog/MyChart/catalog.json'
     with { type: 'json' };

   const catalog = defineCatalog([[MyChart, myChartManifest]]);
   ```

`npx @lynx-js/genui a2ui generate catalog` is the user-facing command;
`@lynx-js/genui/a2ui-catalog-extractor` is the TypeDoc-powered engine behind
it. Two constraints to keep extraction happy: the component folder name must
match the exported function name (`src/catalog/MyChart/index.tsx` exports
`function MyChart`), and framework-level props are excluded from the emitted
schema. See the
[extractor README](../../a2ui-catalog-extractor/README.md) for details.

## Catalog API reference

All of these are exported from `@lynx-js/genui/a2ui` (and from the
`/catalog` subpath).

- **`defineCatalog(inputs)`** — builds the runtime catalog. `inputs` is an
  array that can mix bare components, `[component, manifest]` tuples,
  already-resolved entries (e.g. from `mergeCatalogs`), and function
  entries. Duplicate names within the same kind are rejected. Function
  entries register their impls into `functionRegistry` immediately, so any
  `executeFunctionCall` after `defineCatalog` can route to them.
- **`mergeCatalogs(...catalogs)`** — merges catalogs with **last-write-wins**
  on duplicate names. Useful for layering: a page catalog overrides a brand
  catalog which overrides the built-ins.
- **`serializeCatalog(catalog)`** — emits the JSON manifest for the Agent
  handshake. Components without an attached schema serialize to `{ name }`
  only; functions serialize with their parameter schema when available.
- **`resolveCatalog(catalog)`** — returns a `name → component` map. The
  renderer uses it internally to resolve `{ component: 'Text' }`; exposed for
  advanced cases.
- **`defineFunction(impl, manifest?)`** — wraps a function implementation
  into a catalog entry. With a manifest, the name comes from the manifest's
  key and the schema is announced to the Agent; without one, the name comes
  from `impl.displayName ?? impl.name` and the Agent simply won't see the
  parameter schema.

## Where to go next

- [Overview and architecture](./overview.md) — how a message becomes UI, the
  responsibility split, and the export map.
- [System prompts](./system-prompts.md) — generate the model instructions
  that pair an Agent with your catalog.
- [Open the A2UI playground](https://lynxjs.org/a2ui) — try it live.
