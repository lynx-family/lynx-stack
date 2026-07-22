# Libraries, built-ins, and custom components

An OpenUI **Library** is the contract between your Agent and your client. It
describes the component calls the Agent may write, provides JSON Schema for
parsing and prompt generation, and maps each allowed name to a trusted
ReactLynx renderer.

This guide covers the default Library, its 26 built-in components, and the
process for adding or replacing components.

## What a Library contains

Each component definition has four parts:

- a stable OpenUI component `name`;
- a Zod object schema whose field order defines positional argument order;
- a short `description` used in generated prompts;
- a trusted ReactLynx `component` implementation.

`createOpenUiLibrary()` assembles those definitions into a `Library` with:

| Member            | Purpose                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components`      | Name-to-definition map used by the renderer.                                                                                                                      |
| `componentGroups` | Categories and ordering hints used in prompts and tooling.                                                                                                        |
| `root`            | Required component type for the `root` statement; defaults to `Stack`.                                                                                            |
| `toJSONSchema()`  | Parser/handshake schema with positional prop definitions.                                                                                                         |
| `toSpec()`        | Framework-independent prompt specification.                                                                                                                       |
| `prompt(options)` | Low-level prompt generation for this exact Library. For server use, prefer the headless prompt entry described in the [system prompt guide](./system-prompts.md). |

Create the default Library once and keep its identity stable:

```tsx
const library = useMemo(() => createOpenUiLibrary(), []);

<OpenUiRenderer response={response} library={library} />;
```

## Built-in components

`createOpenUiLibrary()` includes the following components. Their definitions
are also exported from `@lynx-js/genui/openui/catalog`.

### Layout

| Component | Purpose                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `Stack`   | General row/column layout with wrapping, spacing, alignment, and justification. The default Library root. |
| `Row`     | Horizontal layout container.                                                                              |
| `Column`  | Vertical layout container.                                                                                |
| `List`    | Vertical or horizontal collection with optional dividers and spacing.                                     |

### Content

| Component     | Purpose                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `Card`        | Styled `card`, `sunk`, or `clear` container with Stack-like layout props.    |
| `CardHeader`  | Title and optional subtitle for a card.                                      |
| `Text`        | Plain text with semantic variants such as `h1`, `h2`, `caption`, and `body`. |
| `TextContent` | Content text with compact size/weight variants.                              |
| `Separator`   | Simple visual separator.                                                     |
| `Divider`     | Horizontal or vertical dividing rule.                                        |

### Buttons

| Component | Purpose                                                                            |
| --------- | ---------------------------------------------------------------------------------- |
| `Button`  | Tappable primary, secondary, or tertiary action with optional destructive styling. |
| `Buttons` | Group of `Button` components.                                                      |

### Data display and media

| Component     | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `Tag`         | Compact label or status tag.                               |
| `Image`       | Remote image with fit and semantic size variants.          |
| `Icon`        | Bundled Material Icons glyph with size and color variants. |
| `Video`       | Video attachment placeholder with URL and optional title.  |
| `AudioPlayer` | Audio attachment placeholder with URL and description.     |
| `Loading`     | Inline or block skeleton/loading feedback.                 |

### Overlays

| Component | Purpose                                                  |
| --------- | -------------------------------------------------------- |
| `Tabs`    | Switches among labeled child views.                      |
| `Modal`   | Opens generated detail content from a trigger component. |

### Inputs

| Component       | Purpose                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `CheckBox`      | Boolean input with optional action and form name.                                |
| `RadioGroup`    | Single-choice input with default, card, or row presentation.                     |
| `ChoicePicker`  | Choice UI displayed as chips, a list, or a dropdown-like control.                |
| `Slider`        | Numeric range input with optional step and action.                               |
| `TextField`     | Short text, number, password, or multiline input with optional regex validation. |
| `DateTimeInput` | Date/time value with label, bounds, and date/time display flags.                 |

`RadioGroup`, `Slider`, and `TextField` use `@lynx-js/lynx-ui`; add that peer
dependency when those components are available to generated UI.

For exact current positional signatures and a live preview, open the
[OpenUI Catalog](https://lynx-stack.dev/genui/#/openui/catalog). The schema is
the source of truth: optional arguments may be omitted only from the right, and
named-argument syntax is not supported.

## OpenUI component syntax

The order of fields in a component's Zod object is its wire-level positional
argument order. For example, the built-in Stack schema begins with
`children`, `direction`, `wrap`, `gap`, `align`, and `justify`, so this is valid:

```text
root = Stack([header, body], "column", false, "m", "stretch", "start")
```

This is not valid OpenUI Lang:

```text
root = Stack(children: [header, body], gap: "m")
```

Child components are values. They can be declared as named statements or used
inline when the parent schema accepts them:

```text
root = Card([title, TextContent("Inline content")])
title = CardHeader("Account", "Updated just now")
```

## Add a custom component

Install Zod if the application does not already depend on it:

```sh
pnpm add zod
```

Define a component with a stable name, ordered prop schema, prompt description,
and ReactLynx renderer. Put styles in a CSS class rather than inline style
objects, and wrap visible text in `<text>`.

```tsx
import { createOpenUiLibrary, defineComponent } from '@lynx-js/genui/openui';
import { z } from 'zod/v4';

import './Banner.css';

export const Banner = defineComponent({
  name: 'Banner',
  description: 'Compact status banner with a title and tone.',
  props: z.object({
    title: z.string(),
    tone: z.enum(['info', 'success', 'warning']).optional(),
  }),
  component: ({ props }) => (
    <view className={`Banner Banner-${props.tone ?? 'info'}`}>
      <text className='BannerTitle'>{props.title}</text>
    </view>
  ),
});

export const library = createOpenUiLibrary({
  components: [Banner],
  componentGroups: [
    { name: 'Product', components: ['Banner'] },
  ],
});
```

The Agent can now emit:

```text
root = Stack([notice])
notice = Banner("Payment received", "success")
```

Caller-provided components and groups are appended after the defaults. If a
custom component uses the same name as a built-in, the later custom definition
wins in the `components` map. Treat that as an intentional override and keep
the prompt-side schema identical.

## Render nested component values

If a custom prop accepts child components, use `renderNode` from the component
render contract. It recursively renders elements, arrays, and primitive values
using the active Library.

```tsx
export const Panel = defineComponent({
  name: 'Panel',
  description: 'A titled container for generated child content.',
  props: z.object({
    title: z.string(),
    children: z.array(z.any()),
  }),
  component: ({ props, renderNode }) => (
    <view className='Panel'>
      <text className='PanelTitle'>{props.title}</text>
      <view className='PanelBody'>{renderNode(props.children)}</view>
    </view>
  ),
});
```

Do not call generated functions or evaluate generated strings inside a custom
component. Let the OpenUI parser/runtime resolve expressions before props reach
the renderer.

## Runtime hooks for interactive components

Custom components may use the hooks exported from
`@lynx-js/genui/openui`:

| Hook                                                | Use                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `useRenderNode()`                                   | Render nested generated values.                                    |
| `useTriggerAction()`                                | Run an `ActionPlan` or emit a host action.                         |
| `useIsStreaming()`                                  | Disable interaction while generated text is incomplete.            |
| `useIsQueryLoading()`                               | Read whether any Query is in flight.                               |
| `useGetFieldValue()`                                | Read `$variables` or form values from the runtime Store.           |
| `useSetFieldValue()`                                | Update form state and optionally trigger persistence.              |
| `useSetDefaultValue()`                              | Initialize a field after streaming without overwriting user input. |
| `useOpenUI()`                                       | Access the complete runtime context for advanced integrations.     |
| `useFormValidation()` / `useCreateFormValidation()` | Read or create a validation boundary for custom forms.             |

All of these hooks must run below `<OpenUiRenderer>`. Interactive components
should honor `isStreaming` so a user cannot act on a partial model response.

## JSON Schema and parser utilities

Use the Library schema for parsing outside the renderer or for inspection:

```ts
import { createOpenUiLibrary, createParser } from '@lynx-js/genui/openui';

const library = createOpenUiLibrary();
const parser = createParser(library.toJSONSchema(), library.root);
const result = parser.parse('root = Stack([TextContent("Hello")])');
```

For streamed text, use `createStreamingParser`. Its `set(fullText)` method is
convenient when your UI stores the accumulated response; `push(chunk)` accepts
only the new delta.

Use the renderer's `onParseResult` callback when you already render the same
response. That avoids creating a second parser just to inspect `root`,
`stateDeclarations`, data statements, or `meta` diagnostics.

## Keep the Agent contract aligned

Adding a component only to the ReactLynx Library is not enough: the Agent must
receive the same name, positional schema, and description. The default prompt
entry is deliberately headless so server code does not import ReactLynx or
component CSS. For custom components, define matching headless prompt entries
and pass them to `buildOpenUiSystemPrompt`.

See [System prompts](./system-prompts.md) for the complete CLI and programmatic
flow.
