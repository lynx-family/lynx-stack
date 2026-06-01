# @lynx-js/genui/a2ui

English | [简体中文](./README_zh.md)

`@lynx-js/genui/a2ui` is the ReactLynx client runtime for A2UI v0.9. It
consumes validated A2UI server-to-client JSON messages and renders trusted
ReactLynx components in your app.

Use this package when you already have, or plan to build, an Agent service that
returns A2UI messages. The package does not host an Agent, call an LLM, own a
backend route, or provide a chat shell. Your app owns the transport layer and
pushes messages into the renderer.

If you have never used A2UI before, think of it this way:

- In React, your code chooses components and passes props.
- In A2UI, an Agent chooses from a component catalog that your app publishes.
- The client still renders real ReactLynx components. The model only sends data
  that says which approved component to render and what props to use.

The result is not arbitrary generated code. It is a ReactLynx UI tree assembled
from a trusted catalog.

## Install

Install the published GenUI package in a ReactLynx app:

```sh
pnpm add @lynx-js/genui @lynx-js/react
```

Import the optional default theme tokens once if you want to use the built-in
light/dark CSS variables:

```ts
import '@lynx-js/genui/a2ui/styles/theme.css';
```

## Quick Start

Create a `MessageStore`, register the components that generated UI is allowed
to render, and forward generated actions back to your Agent service.

```tsx
import {
  A2UI,
  Button,
  Text,
  basicFunctions,
  createMessageStore,
  normalizePayloadToMessages,
} from '@lynx-js/genui/a2ui';

const store = createMessageStore();
const catalogs = [Text, Button, ...basicFunctions];

async function sendPrompt(input: string) {
  const res = await fetch('/a2ui/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: input }] }),
  });

  store.push(normalizePayloadToMessages(await res.json()));
}

<A2UI
  messageStore={store}
  catalogs={catalogs}
  wrapSurface={(children) => <view className='a2ui-light'>{children}</view>}
  onAction={(action) => {
    void fetch('/a2ui/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    })
      .then((res) => res.json())
      .then((payload) => store.push(normalizePayloadToMessages(payload)));
  }}
/>;
```

`MessageStore` stores raw protocol messages in arrival order. `<A2UI>`
subscribes to it, processes new messages, renders the active surface, and emits
generated UI actions through `onAction`.

## What You Own

| Part                   | Owner            | Role                                                                                                                     |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@lynx-js/genui/a2ui`  | This package     | ReactLynx renderer, `MessageStore`, catalog APIs, built-in components, protocol helpers, and client function entries.    |
| `genui a2ui`           | GenUI CLI        | Build-time commands for generating custom catalog artifacts and A2UI system prompts.                                     |
| Your Agent service     | Your application | Receives user prompts/actions, calls a model with the A2UI prompt and catalog, validates output, and returns messages.   |
| Your transport adapter | Your application | Calls the Agent service, handles REST or streaming responses, writes messages into `MessageStore`, and forwards actions. |

## First Things To Know

- Pass only the components you want generated UI to use through `catalogs`.
- Include `...basicFunctions` when messages may use A2UI function calls such as
  `formatString`, `formatDate`, `required`, `email`, or `and`.
- Pair components with their `catalog.json` manifests when you need
  `serializeCatalog(...)` to send JSON schemas to an Agent.
- There is intentionally no `@lynx-js/genui/a2ui/catalog/all` export. Compose
  the exact catalog you want at the integration site so bundle cost is visible.
- For a new turn or session, mount `<A2UI>` with a different `key`; the
  component owns its `MessageProcessor` for the lifetime of the mount.

## More Docs

- [Architecture and exports](./docs/architecture.md)
- [Catalogs and manifests](./docs/catalogs.md)
- [Custom components](./docs/custom-components.md)
- [Built-in catalog composition](./src/catalog/README.md)
- [Open the A2UI playground](https://lynxjs.org/a2ui)
