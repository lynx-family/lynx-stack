# @lynx-js/genui/openui

English | [简体中文](./README_zh.md)

`@lynx-js/genui/openui` is the ReactLynx client runtime for OpenUI Lang v0.5.
It parses declarative OpenUI text, evaluates reactive state and data operations,
and renders the result with a trusted ReactLynx component library.

Use this package when an Agent produces OpenUI Lang and your Lynx app owns the
transport, tools, state persistence, and host actions. The Agent emits data, not
executable UI code: it can only instantiate components described by the library
you give to the renderer.

If you are new to OpenUI, think of it this way:

- In React, your code chooses components and passes props.
- In OpenUI, an Agent writes one assignment per line using the components in
  your library.
- The client parses those assignments and renders the real ReactLynx
  components you registered.

## Install

Install the published GenUI package in a ReactLynx app:

```sh
pnpm add @lynx-js/genui @lynx-js/react @lynx-js/lynx-ui @lynx-js/luna-styles
```

The default catalog uses the headless behavior primitives from
`@lynx-js/lynx-ui` and the semantic visual tokens from
`@lynx-js/luna-styles`. The built-in `Button`, `CheckBox`, `Modal`,
`RadioGroup`, `Slider`, and `TextField` components use the lynx-ui primitives.

Import Luna before the OpenUI token adapter, then apply a Luna theme class
around the renderer. Renderer and component CSS are included by their modules;
there is no separate renderer stylesheet to import. Luna also provides
`lunaris-light` and `lunaris-dark` when that palette is preferred.

```ts
import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';
```

## Quick start

Create a library, pass raw OpenUI Lang to `<OpenUiRenderer>`, and handle actions
that need the host application.

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo } from '@lynx-js/react';

import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';

const response = String.raw`
root = Stack([header, card], "column", false, "m", "stretch", "start")
header = Text("Hello OpenUI", "h2")
card = Card([message, actions])
message = TextContent("This UI was described as data.")
actions = Buttons([Button("Continue", Action([@ToAssistant("Continue")]), "primary")])
`.trim();

export function GeneratedView() {
  const library = useMemo(() => createOpenUiLibrary(), []);

  return (
    <view className='luna-light'>
      <OpenUiRenderer
        response={response}
        library={library}
        onAction={(event) => {
          // Forward ContinueConversation/OpenUrl events to your host.
          console.info(event.humanFriendlyMessage);
        }}
      />
    </view>
  );
}
```

The raw response must be OpenUI Lang, not a Markdown code fence. Every line is
an assignment, and the render entry point must be named `root`:

```text
identifier = Component(positional, arguments)
$variable = defaultValue
data = Query("tool_name", { argument: $variable }, { fallback: true })
```

## What you own

| Part                    | Owner            | Role                                                                                                    |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `@lynx-js/genui/openui` | This package     | OpenUI parser/runtime adapter, ReactLynx renderer, built-in library, state/actions, and prompt helpers. |
| Your Agent service      | Your application | Calls a model with the OpenUI system prompt and returns raw OpenUI Lang text.                           |
| Your transport adapter  | Your application | Delivers text deltas or snapshots, handles completion, errors, and request cancellation.                |
| Your tool provider      | Your application | Implements the tools referenced by `Query()` and `Mutation()`.                                          |
| Your host shell         | Your application | Persists state and handles assistant/open-URL actions emitted by the renderer.                          |

## First things to know

- Use `<OpenUiRenderer response={...}>` for OpenUI v0.5. The legacy
  `result={parseResult}` path renders pre-parsed static trees but does not own
  the v0.5 query, mutation, or reactive-state runtime.
- For streaming, pass the accumulated `response` together with `isStreaming`.
  The renderer incrementally parses text; queries and built-in interactions wait
  until generation completes.
- Query defaults and `initialQueryResults` are available during the first
  synchronous render after a response completes. Prefetched results are keyed
  by Query assignment name, not tool name. If you also pass a `toolProvider`,
  the Query revalidates after commit and whenever reactive arguments change.
  `Mutation()` only runs through `@Run(...)` in an action.
- `onAction` receives host actions such as `@ToAssistant(...)` and
  `@OpenUrl(...)`. State steps and tool steps execute inside the runtime first.
- `onError` returns structured parser, runtime, render, and tool errors suitable
  for an Agent correction loop.
- By default, `createOpenUiLibrary()` includes 26 built-in components. Additional
  definitions are appended, and a later component with the same name replaces
  the built-in implementation.
- `includeDefaultComponents: false` limits the Library vocabulary to
  caller-provided definitions. The flag does not remove the default catalog
  from the main entry's static dependencies. When omitted built-ins must stay
  outside that graph, import `createOpenUiLibrary` from
  `@lynx-js/genui/openui/explicit` and each retained built-in from its component
  subpath, such as `@lynx-js/genui/openui/catalog/Stack`.

## Stream model output

Pass the accumulated model text as `response` and the generation state as
`isStreaming`. Reuse existing React or conversation state if your application
already owns both; no separate parser is needed.

- `response` is the full text received so far, not the latest delta. Append deltas;
  replace the text when your transport sends a cumulative snapshot.
- Keep `isStreaming={true}` throughout generation. Partial UI renders, while
  Query execution, mutation registration, and built-in interactions wait.
- On successful completion, apply the authoritative final text and set
  `isStreaming={false}` together. Its default is `false`; static or persisted
  complete responses can omit it.

### Connect your transport

Keep text and generation state in one state object so they update together.
The handlers below illustrate connecting a transport that emits deltas or full
snapshots; use the handler matching your transport's text format:

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo, useState } from '@lynx-js/react';

export function GeneratedView() {
  const library = useMemo(() => createOpenUiLibrary(), []);
  const [output, setOutput] = useState({
    response: null as string | null,
    isStreaming: false,
  });

  function onStart() {
    setOutput({ response: '', isStreaming: true });
  }

  function onDelta(delta: string) {
    setOutput((current) => ({
      response: (current.response ?? '') + delta,
      isStreaming: true,
    }));
  }

  function onSnapshot(fullText: string) {
    setOutput({ response: fullText, isStreaming: true });
  }

  function onDone(finalText: string) {
    setOutput({ response: finalText, isStreaming: false });
  }

  function onFailureOrCancel() {
    setOutput({ response: null, isStreaming: false });
  }

  // Connect these handlers to your transport.
  return <OpenUiRenderer library={library} {...output} />;
}
```

If completion provides no final text, keep the accumulated response and update
only the flag: `setOutput(current => ({ ...current, isStreaming: false }))`.
Even when final text equals the last partial, the flag must change to enable
queries, completion diagnostics, and interactions. Custom interactive components
should honor `useIsStreaming()` too.

### How incremental parsing works

The renderer retains a streaming parser while `library` stays the same. Although
`response` supplies the full accumulated text, the parser detects appended text,
caches completed statements, and reparses the unfinished tail to preview partial
output. Forward references become renderable when their targets arrive. Changing
or shortening previously received text resets the parser's cache; keep Library
identity stable with `useMemo` or a module constant.

This is statement-level incremental parsing: preprocessing and result rebuilding
still run on each text update, and one long unfinished statement can be reparsed
repeatedly. It does not provide a component-patch protocol. Changing only
`isStreaming` with unchanged text does not rerun parsing.

### Completion, cancellation, and new sessions

For SSE, finish only after the successful `done` event, using its authoritative
text. A connection closing by itself does not confirm success.

On failure or cancellation, clear incomplete text with
`{ response: null, isStreaming: false }`; do not enable queries or actions for an
unfinished result. State updates do not cancel network requests: your transport
owns cancellation and error reporting. Before starting another generation, stop
the old request and reject late events, then reset the text. Clearing response
does not reset runtime form state; use a new renderer `key` when a fresh session
should reset that state.

## More docs

- [Overview and architecture](./docs/overview.md)
- [Libraries, built-ins, and custom components](./docs/library-guide.md)
- [System prompts](./docs/system-prompts.md)
- [Open the GenUI playground](https://lynx-stack.dev/genui/#/openui)
- [Read the OpenUI Lang v0.5 specification](https://www.openui.com/docs/openui-lang/specification-v05)
