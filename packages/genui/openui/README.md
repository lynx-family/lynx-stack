# @lynx-js/openui-reactlynx

ReactLynx renderer for the [OpenUI DSL](https://www.openui.com/). Parses
OpenUI functional notation into a renderable tree and renders it via a
pluggable component catalog in Lynx applications.

This package includes:

- `createOpenUiLibrary`: factory that builds an OpenUI `Library` instance
  with built-in components, fully customizable via options.
- `defineComponent`: define custom components with Zod-validated props.
- `OpenUiRenderer`: ReactLynx component that renders a parsed OpenUI tree.
- `createParser` / `createStreamingParser`: parse OpenUI DSL text
  (functional notation) into a renderable AST.
- `catalog/*`: built-in component renderers (Stack, Card, CardHeader,
  TextContent, Separator, Button, Buttons, Tag).

## Exports

- `@lynx-js/openui-reactlynx`: `createOpenUiLibrary`, `defineComponent`,
  `OpenUiRenderer`, parser utilities, and all core types.
- `@lynx-js/openui-reactlynx/catalog`: re-exports of built-in catalog
  components for tree-shake-friendly subpath access.

## Installation

Make sure your app provides the peer dependencies:

- `@lynx-js/react`

```bash
pnpm add @lynx-js/openui-reactlynx
```

## Quick Start

1. Create a library and get its JSON Schema.
2. Create a streaming parser from the schema.
3. Feed OpenUI DSL text (chunks or full) into the parser.
4. Render the parse result with `<OpenUiRenderer>`.

```tsx
import {
  createOpenUiLibrary,
  createStreamingParser,
  OpenUiRenderer,
} from '@lynx-js/openui-reactlynx';
import type { ParseResult } from '@lynx-js/openui-reactlynx';
import { useEffect, useMemo, useState } from '@lynx-js/react';

const library = createOpenUiLibrary();
const schema = library.toJSONSchema();

export function App() {
  const [result, setResult] = useState<ParseResult | null>(null);

  useEffect(() => {
    const parser = createStreamingParser(schema);

    // OpenUI DSL uses functional notation:
    const rawText = `
root = Stack([header, card], "column", "l", "center")
header = TextContent("Hello OpenUI", "large-heavy")
card = Card([content, btn], "card")
content = TextContent("Welcome to OpenUI")
btn = Buttons([Button("Get Started", Action([@ToAssistant("clicked")]), "primary")])
    `.trim();

    // Feed the entire text (or stream it chunk by chunk)
    const parsed = parser.push(rawText);
    setResult(parsed);
  }, []);

  if (!result?.root) return null;

  return (
    <OpenUiRenderer
      result={result}
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
import {
  createOpenUiLibrary,
  createStreamingParser,
  OpenUiRenderer,
} from '@lynx-js/openui-reactlynx';
import type { ParseResult } from '@lynx-js/openui-reactlynx';
import { useEffect, useMemo, useRef, useState } from '@lynx-js/react';

const CHUNK_SIZE = 8;
const STREAM_DELAY_MS = 30;

export function StreamingApp({ rawText }: { rawText: string }) {
  const library = useMemo(() => createOpenUiLibrary(), []);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsStreaming(true);

    const schema = library.toJSONSchema();
    const parser = createStreamingParser(schema);
    let offset = 0;

    const tick = () => {
      if (cancelled || offset >= rawText.length) {
        setIsStreaming(false);
        return;
      }
      const chunk = rawText.slice(offset, offset + CHUNK_SIZE);
      offset += CHUNK_SIZE;
      setResult(parser.push(chunk));
      setTimeout(tick, STREAM_DELAY_MS);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [library, rawText]);

  if (!result?.root) return null;

  return (
    <OpenUiRenderer
      result={result}
      library={library}
      isStreaming={isStreaming}
    />
  );
}
```

## Customizing the Library

`createOpenUiLibrary` accepts an optional `CreateOpenUiLibraryOptions`
object. Provided `components` and `componentGroups` are **merged** with
the built-in defaults (appended after the defaults):

```tsx
import {
  createOpenUiLibrary,
  defineComponent,
} from '@lynx-js/openui-reactlynx';
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
