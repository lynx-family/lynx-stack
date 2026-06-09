# @lynx-js/genui/openui

ReactLynx renderer for the [OpenUI DSL](https://www.openui.com/). Parses
OpenUI functional notation into a renderable tree and renders it via a
pluggable component catalog in Lynx applications.

This package includes:

- `createOpenUiLibrary`: factory that builds an OpenUI `Library` instance
  with built-in components, fully customizable via options.
- `defineComponent`: define custom components with Zod-validated props.
- `OpenUiRenderer`: ReactLynx component that parses and renders OpenUI Lang
  v0.5 responses, including `$variables`, `Query()`, `Mutation()`, and
  `Action([@...])` steps.
- `createParser` / `createStreamingParser`: parse OpenUI DSL text
  (functional notation) into a renderable AST.
- `catalog/*`: built-in component renderers (Stack, Card, CardHeader,
  TextContent, Separator, Button, Buttons, Tag).

## Exports

- `@lynx-js/genui/openui`: `createOpenUiLibrary`, `defineComponent`,
  `OpenUiRenderer`, parser utilities, and all core types.
- `@lynx-js/genui/openui/catalog`: re-exports of built-in catalog
  components for tree-shake-friendly subpath access.

## Installation

Make sure your app provides the peer dependencies:

- `@lynx-js/react`

```bash
pnpm add @lynx-js/genui
```

## Quick Start

1. Create a library.
2. Pass raw OpenUI Lang text to `<OpenUiRenderer response={...}>`.
3. Handle actions from `@ToAssistant()` / `@OpenUrl()` with `onAction`.

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo } from '@lynx-js/react';

const rawText = `
root = Stack([header, card], "column", "l", "center")
header = TextContent("Hello OpenUI", "large-heavy")
card = Card([content, btn], "card")
content = TextContent("Welcome to OpenUI")
btn = Buttons([Button("Get Started", Action([@ToAssistant("clicked")]), "primary")])
`.trim();

export function App() {
  const library = useMemo(() => createOpenUiLibrary(), []);

  return (
    <OpenUiRenderer
      response={rawText}
      library={library}
      onAction={(event) => {
        console.log('Action:', event.humanFriendlyMessage);
      }}
    />
  );
}
```

## Streaming

For real-time streaming scenarios (e.g., LLM output), feed chunks
incrementally:

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useEffect, useMemo, useState } from '@lynx-js/react';

const CHUNK_SIZE = 8;
const STREAM_DELAY_MS = 30;

export function StreamingApp({ rawText }: { rawText: string }) {
  const library = useMemo(() => createOpenUiLibrary(), []);
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsStreaming(true);
    setResponse('');
    let offset = 0;

    const tick = () => {
      if (cancelled || offset >= rawText.length) {
        setIsStreaming(false);
        return;
      }
      const chunk = rawText.slice(offset, offset + CHUNK_SIZE);
      offset += CHUNK_SIZE;
      setResponse((prev) => prev + chunk);
      setTimeout(tick, STREAM_DELAY_MS);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [library, rawText]);

  return (
    <OpenUiRenderer
      response={response}
      library={library}
      isStreaming={isStreaming}
    />
  );
}
```

## v0.5 Runtime

Use the `response` renderer entry point for v0.5 features:

```tsx
const ui = `
$title = ""
data = Query("list_items", { search: $title }, { rows: [] })
save = Mutation("save_item", { title: $title })
root = Stack([
  TextContent("Rows: " + @Count(data.rows)),
  Button("Save", Action([@Run(save), @Run(data), @Reset($title)]))
])
`.trim();

<OpenUiRenderer
  response={ui}
  library={library}
  toolProvider={{
    list_items: async (args) => ({ rows: [] }),
    save_item: async (args) => ({ ok: true }),
  }}
  onStateUpdate={(state) => persist(state)}
  initialState={{ $title: 'Draft' }}
/>;
```

`OpenUiRenderer` still accepts `result={parseResult}` for legacy/static
callers, but `Query()`, `Mutation()`, `$variables`, and runtime expression
evaluation require the raw `response` path.

## Customizing the Library

`createOpenUiLibrary` accepts an optional `CreateOpenUiLibraryOptions`
object. Provided `components` and `componentGroups` are **merged** with
the built-in defaults (appended after the defaults):

```tsx
import { createOpenUiLibrary, defineComponent } from '@lynx-js/genui/openui';
import { z } from 'zod/v4';

const MyBanner = defineComponent({
  name: 'Banner',
  description: 'A promotional banner',
  props: z.object({ title: z.string(), color: z.string().optional() }),
  component: (props) => (
    <view style={{ backgroundColor: props.color ?? '#f0f0f0' }}>
      <text>{props.title}</text>
    </view>
  ),
});

const library = createOpenUiLibrary({
  root: 'Stack',
  components: [MyBanner],
  componentGroups: [
    { name: 'Custom', components: ['Banner'] },
  ],
});
```

### Options

| Option            | Type                 | Default       | Description                                    |
| ----------------- | -------------------- | ------------- | ---------------------------------------------- |
| `root`            | `string`             | `'Stack'`     | Name of the root component                     |
| `components`      | `DefinedComponent[]` | `[]` (merged) | Additional components appended to built-in set |
| `componentGroups` | `ComponentGroup[]`   | `[]` (merged) | Additional groups appended to built-in groups  |

## OpenUI DSL Syntax

The DSL uses a **functional notation** (not XML). Each statement assigns
a component instance to an identifier:

```
root = Stack([header, card], "column", "l", "center")
header = TextContent("Choose Your Plan", "large-heavy")
card = Card([cardHeader, sep, features, btn], "card")
cardHeader = CardHeader("Pro", "For growing teams")
sep = Separator("horizontal", true)
features = Stack([f1, f2], "column", "s")
f1 = TextContent("✓  Unlimited projects")
f2 = TextContent("✓  Priority support")
btn = Buttons([Button("Start Trial", Action([@ToAssistant("start")]), "primary")])
```

## JSON Schema

Generate a JSON Schema representation of the library for LLM agent
handshakes:

```ts
const library = createOpenUiLibrary();
const schema = library.toJSONSchema();
// Pass `schema` to your LLM / agent for structured output generation.
```
