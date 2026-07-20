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
pnpm add @lynx-js/genui @lynx-js/react @lynx-js/lynx-ui
```

The built-in `RadioGroup`, `Slider`, and `TextField` components use
`@lynx-js/lynx-ui`, so include that peer when using the default Library.

Import the optional theme tokens once, then apply a light or dark theme class
around the renderer. Renderer and component CSS are included by their modules;
there is no separate renderer stylesheet to import.

```ts
import '@lynx-js/genui/openui/styles/theme.css';
```

## Quick start

Create a library, pass raw OpenUI Lang to `<OpenUiRenderer>`, and handle actions
that need the host application.

```tsx
import { createOpenUiLibrary, OpenUiRenderer } from '@lynx-js/genui/openui';
import { useMemo } from '@lynx-js/react';

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
    <view className='openui-light'>
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
| Your transport adapter  | Your application | Streams or sets the accumulated response text and cancels stale requests.                               |
| Your tool provider      | Your application | Implements the tools referenced by `Query()` and `Mutation()`.                                          |
| Your host shell         | Your application | Persists state and handles assistant/open-URL actions emitted by the renderer.                          |

## First things to know

- Prefer `<OpenUiRenderer response={...}>` for OpenUI v0.5. The legacy
  `result={parseResult}` path renders pre-parsed static trees but does not own
  the v0.5 query, mutation, or reactive-state runtime.
- While a model is streaming, pass the accumulated response together with
  `isStreaming`. The incremental parser keeps completed statements renderable,
  and built-in interactions stay disabled until the stream finishes.
- `Query()` executes after a complete response and re-runs when reactive
  arguments change. `Mutation()` only runs through `@Run(...)` in an action.
- `onAction` receives host actions such as `@ToAssistant(...)` and
  `@OpenUrl(...)`. State steps and tool steps execute inside the runtime first.
- `onError` returns structured parser, runtime, render, and tool errors suitable
  for an Agent correction loop.
- `createOpenUiLibrary()` includes 26 built-in components. Additional
  definitions are appended, and a later component with the same name replaces
  the built-in implementation.

## More docs

- [Overview and architecture](./docs/overview.md)
- [Libraries, built-ins, and custom components](./docs/library-guide.md)
- [System prompts](./docs/system-prompts.md)
- [Open the GenUI playground](https://lynx-stack.dev/genui/#/openui)
- [Read the OpenUI Lang v0.5 specification](https://www.openui.com/docs/openui-lang/specification-v05)
