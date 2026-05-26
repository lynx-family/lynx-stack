# Lynx GenUI

English | [简体中文](./README_zh.md)

Lynx GenUI is the generated-UI stack for developers who already know React and
want AI to assemble native Lynx interfaces from trusted components.

If you have never heard of A2UI, think of it this way:

- In React, your code chooses components and passes props.
- In GenUI, an agent chooses from a component catalog that you publish.
- The client still renders real ReactLynx components. The model only sends
  data that says which approved component to render and what props to use.

A2UI is the message protocol in the middle. It is not a replacement for React,
and it is not a new styling system. It is a safe, JSON-based way for an agent to
say: create a surface, render these components, update this data, and report
this user action back to the agent.

## Why It Exists

Generated UI becomes useful when it has product constraints:

- The agent can only use components your app has registered.
- Component props are described with TypeScript-derived schemas.
- Model output is validated before the client renders it.
- UI can stream in progressively instead of waiting for one giant response.
- User actions are sent back as structured events, similar to React event
  handlers crossing a network boundary.

The result is not arbitrary generated code. It is a ReactLynx UI tree assembled
from a trusted catalog.

## From React To GenUI

Here is the React mental model:

```tsx
function WeatherCard(props: WeatherCardProps) {
  return (
    <Card>
      <Text>{props.city}</Text>
      <Text>{props.temperature}</Text>
      <Button onClick={props.onRefresh}>Refresh</Button>
    </Card>
  );
}
```

Here is the GenUI mental model:

1. You publish `Card`, `Text`, `Button`, and any custom components into a
   catalog.
2. The agent receives the user's request and the catalog description.
3. The agent emits A2UI messages such as "render a Card with these children".
4. The client pushes those messages into a `MessageStore`.
5. `<A2UI>` renders the matching ReactLynx components.
6. When a user taps a generated button, `onAction` fires and your app sends the
   action back to the agent.

The model never imports your code. It only names components that the renderer
has already allowed.

## What You Use

For a product app using A2UI, the important surfaces are:

| Surface                       | Role                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@lynx-js/a2ui-reactlynx`     | ReactLynx renderer for A2UI v0.9. It provides `<A2UI>`, `MessageStore`, catalog APIs, built-in components, and protocol helpers.           |
| `npx @lynx-js/a2ui-cli`       | Build-time command for generating catalog artifacts from TypeScript contracts and A2UI system prompts for your agent.                      |
| Your agent service            | A backend you own. It receives user prompts/actions, calls a model with the A2UI prompt and catalog, validates output, and returns A2UI.   |
| Your transport implementation | Client code that calls your agent service, handles REST or streaming responses, pushes messages into `MessageStore`, and forwards actions. |

## The Three Pieces

```text
Catalog: what can be rendered
  -> Agent: what should be rendered
  -> Client: render it and send actions back
```

### Catalog

For a React developer, the catalog is your public component API for AI. It is
the generated-UI equivalent of exporting a component plus its prop types.

The catalog tells the agent:

- Component names, such as `Text`, `Column`, `ProductTile`.
- Prop names and types.
- Required fields.
- Allowed enum values.
- Optional functions for dynamic formatting and validation.

The catalog tells the client:

- Which ReactLynx component to instantiate for each A2UI component name.
- Which component names are safe to render.

### Agent

The agent is a UI planner. It receives normal chat messages, reads the catalog,
and returns A2UI JSON messages. Your backend should validate those messages
before returning them to the client.

The important product rule is: the agent designs within your catalog. If a
component is not in the catalog, it should not appear in the generated UI.

### Client

The client owns transport and rendering. It fetches messages from the agent,
pushes them into `MessageStore`, renders `<A2UI>`, and forwards generated user
actions back to your backend.

If you know `useSyncExternalStore`, the `MessageStore` idea should feel
familiar: it is an append-only external store of protocol messages. `<A2UI>`
subscribes to it and updates the rendered surface as messages arrive.

## Quickstart

In your ReactLynx app, install the renderer package and keep the CLI as an
`npx` command. The CLI requires Node.js 22 or newer.

```sh
pnpm add @lynx-js/a2ui-reactlynx
npx @lynx-js/a2ui-cli --help
```

The rest of the flow is app-local: define catalog-facing component contracts,
generate catalog artifacts, give the generated prompt to your agent service,
and render validated A2UI messages in your ReactLynx client.

### 1. Catalog: Turn React Components Into Agent-Visible Components

Start with a component contract. This is the part React developers already do
well: name the props and keep the component predictable.

```tsx
/**
 * Product tile for commerce recommendations.
 *
 * @a2uiCatalog ProductTile
 */
export interface ProductTileProps {
  /** Product name shown as the title. */
  title: string;
  /** Price text already localized by the caller. */
  price: string;
  /** Image search query or resolved URL. */
  imageUrl?: string;
}

export function ProductTile(props: ProductTileProps) {
  return (
    <view className='product-tile'>
      {props.imageUrl ? <image src={props.imageUrl} /> : null}
      <text>{props.title}</text>
      <text>{props.price}</text>
    </view>
  );
}

ProductTile.displayName = 'ProductTile';
```

Generate a schema for the agent:

```sh
npx @lynx-js/a2ui-cli generate catalog --catalog-dir src/catalog --out-dir dist/catalog
```

Then pair the component with its manifest:

```tsx
import {
  Button,
  Column,
  Text,
  createMessageStore,
  defineCatalog,
  serializeCatalog,
} from '@lynx-js/a2ui-reactlynx';
import buttonManifest from '@lynx-js/a2ui-reactlynx/catalog/Button/catalog.json'
  with { type: 'json' };
import columnManifest from '@lynx-js/a2ui-reactlynx/catalog/Column/catalog.json'
  with { type: 'json' };
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json'
  with { type: 'json' };
import productTileManifest from './dist/catalog/ProductTile/catalog.json'
  with { type: 'json' };

export const uiCatalog = defineCatalog([
  [Text, textManifest],
  [Column, columnManifest],
  [Button, buttonManifest],
  [ProductTile, productTileManifest],
]);

export const catalogHandshake = serializeCatalog(uiCatalog);
export const store = createMessageStore();
```

Use `catalogHandshake` when your own transport or agent consumes the client
handshake format. If your agent uses a different internal catalog format to
build prompts, add an explicit backend conversion step so the agent sees the
same component names that the client has registered.

There is intentionally no exported "all built-ins" constant. Importing every
component makes bundle cost invisible and weakens tree-shaking. Import only the
built-in components and catalog manifests your generated UI should be allowed to
use.

Production note: minifiers can rewrite function names. Set
`ProductTile.displayName = 'ProductTile'` or pair custom components with their
manifest so the protocol name stays stable.

### 2. CLI: Generate Catalogs And Prompts

The CLI is the build-time bridge between React source code and the agent. Use
it when you want repeatable artifacts instead of hand-maintained JSON:

- `generate catalog` reads TypeScript catalog contracts and writes
  `dist/catalog/<Component>/catalog.json`.
- `generate prompt` reads generated catalog artifacts and writes an A2UI system
  prompt for an agent.

Run the published CLI package through `npx`:

```sh
npx @lynx-js/a2ui-cli generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist/catalog

npx @lynx-js/a2ui-cli generate prompt \
  --catalog-dir dist/catalog \
  --catalog-id https://example.com/catalogs/custom/v1/catalog.json \
  --out dist/a2ui-system-prompt.txt
```

When your build already produces TypeDoc JSON, keep the same
`npx @lynx-js/a2ui-cli` command prefix and pass that file to `generate catalog`:

```sh
npx @lynx-js/a2ui-cli generate catalog \
  --typedoc-json typedoc.json \
  --out-dir dist/catalog
```

Key options:

| Option                  | Use                                                                          |
| ----------------------- | ---------------------------------------------------------------------------- |
| `--catalog-dir <dir>`   | Scan catalog component interfaces, or read generated artifacts for prompts.  |
| `--source <path>`       | Add source files or directories, commonly for catalog functions. Repeatable. |
| `--typedoc-json <file>` | Reuse an existing TypeDoc JSON project instead of running TypeDoc.           |
| `--out-dir <dir>`       | Write generated catalog artifacts. Defaults to `dist/catalog`.               |
| `--catalog-id <id>`     | Set the catalog id expected in generated `createSurface` messages.           |
| `--out <file>`          | Write the generated prompt to a file instead of stdout.                      |
| `--appendix <text>`     | Add extra agent instructions to the generated prompt.                        |

Catalog authoring details:

- Put `@a2uiCatalog` on the props `interface`, not on the component function.
  You can pass the component name explicitly, such as `@a2uiCatalog ProductTile`.
  If the tag is empty, the generator infers the name by removing a trailing
  `Props` or `ComponentProps` from the interface name.
- TypeDoc comments become schema metadata: summary text and `@remarks` become
  `description`, `@defaultValue` or `@default` become `default`,
  `@deprecated` becomes `deprecated: true`, and optional properties are omitted
  from `required`. For object or array defaults, put the JSON value inside a
  code span, such as `` @defaultValue `{}` ``.
- Supported prop types include `string`, `number`, `boolean`, string literal
  enums, unions, arrays, inline object types, and `Record<string, T>`.
- Avoid `any`, `unknown`, `null`, `undefined`, `never`, `void`, nullable
  unions, most imported aliases, referenced external interfaces, and
  non-string `Record` keys. Inline the agent-facing fields directly in the
  marked interface.
- The scanner accepts `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, and `.cts` files.
  It ignores `.d.ts`, `node_modules`, `dist`, and `.turbo`.

Operational notes:

- Keep generated catalog artifacts in your package build output and commit API
  reports or generated manifests when the package contract expects them.
- Regenerate catalog artifacts whenever a catalog-facing props interface or
  `@a2uiFunction` definition changes.
- `generate prompt` uses the built-in A2UI basic catalog when `--catalog-dir`
  is omitted; pass `--catalog-dir` for custom generated catalogs.
- The generated prompt and the client catalog must describe the same component
  names and props. A mismatch can pass server validation but render as
  unsupported on the client.
- `functions` and `theme` are not inferred from component props. Add them
  explicitly through generated function definitions or prompt/catalog helpers.

Keep the generated prompt with your backend code and the generated catalog
artifacts with your app package so agent and client deployments stay in sync.

### 3. Agent: Ask For UI, Receive Validated Messages

Your agent service is a backend route in your product, not browser code. It
should:

- Load the A2UI system prompt generated by `npx @lynx-js/a2ui-cli generate
  prompt`.
- Add conversation history, user intent, and any product state the model needs.
- Call your model provider from the server.
- Validate or repair model output before returning A2UI messages to the client.
- Keep provider credentials, base URLs, and model selection out of untrusted
  browser requests.

A typical request shape looks like this:

```sh
curl https://your-domain.example/api/a2ui/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Create a compact weather card with a photo, temperature, humidity, and a Refresh button."
      }
    ]
  }'
```

The response contains `messages`. Those are not React elements. They are data
instructions that the client renderer can process.

A tiny A2UI response looks like this:

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "main",
      "catalogId": "https://a2ui.org/specification/v0_9/basic_catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Column",
          "children": ["title"]
        },
        {
          "id": "title",
          "component": "Text",
          "text": "Hello from generated UI"
        }
      ]
    }
  }
]
```

You do not need to hand-write this JSON for normal app development. It is
useful to recognize the structure when debugging.

Important endpoints:

| Endpoint                       | Use                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `GET /api/a2ui/health`         | Optional health/configuration check for your backend.                               |
| `POST /api/a2ui/chat`          | Return one validated JSON response.                                                 |
| `POST /api/a2ui/stream`        | Stream model deltas as SSE, then emit validated messages in the final `done` event. |
| `POST /api/a2ui/action`        | Convert a client action into the next validated A2UI response.                      |
| `POST /api/a2ui/action/stream` | Stream an action response and final validation payload.                             |

Common server-side configuration:

| Variable                  | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `OPENAI_API_KEY`          | Model credential kept on the server.                                     |
| `OPENAI_MODEL`            | Model id chosen by your backend.                                         |
| `OPENAI_BASE_URL`         | Optional OpenAI-compatible endpoint.                                     |
| `OPENAI_API_STYLE`        | `responses` or `chat`, depending on your provider integration.           |
| `IMAGE_PROVIDER_API_KEY`  | Optional image provider credential if your agent resolves image queries. |
| `A2UI_CORS_ORIGINS`       | Comma-separated browser origins allowed by your server.                  |
| `A2UI_RATE_LIMIT_PER_MIN` | Per-client request limit for your server.                                |

### 4. Client: Render Messages Like React State

The client fetches agent output and pushes each message into the store.
`<A2UI>` does the protocol processing and renders the matching ReactLynx
components.

```tsx
import {
  A2UI,
  Button,
  Column,
  Text,
  createMessageStore,
} from '@lynx-js/a2ui-reactlynx';
import type { UserActionPayload } from '@lynx-js/a2ui-reactlynx';

const store = createMessageStore();
const catalogs = [Text, Column, Button];

async function sendPrompt(content: string) {
  const response = await fetch('/api/a2ui/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content }],
    }),
  });
  const body = await response.json();
  for (const message of body.messages ?? []) {
    store.push(message);
  }
}

async function sendAction(action: UserActionPayload) {
  const response = await fetch('/api/a2ui/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surfaceId: action.surfaceId,
      action,
    }),
  });
  const body = await response.json();
  for (const message of body.messages ?? []) {
    store.push(message);
  }
}

export function GeneratedUIScreen(): import('@lynx-js/react').ReactNode {
  return (
    <A2UI
      messageStore={store}
      catalogs={catalogs}
      onAction={(action) => {
        void sendAction(action);
      }}
      wrapSurface={(children) => <view className='a2ui-light'>{children}</view>}
    />
  );
}
```

Map this back to React:

- `MessageStore` is the external state source.
- `store.push(message)` is like receiving the next state update from the
  server.
- `catalogs` is the allowlist of components the generated tree may use.
- `onAction` is like an event handler, except the event is serialized and sent
  back to the agent.
- Passing a new React `key` to `<A2UI>` starts a fresh renderer session.

## Transport Layer

GenUI does not prescribe one transport. The protocol messages can travel over
REST, SSE, WebSocket, A2A, AG UI, MCP, or an in-process mock. In a React app,
the transport layer is the adapter between your product state and
`MessageStore`.

It owns:

- Calling the agent endpoint.
- Passing conversation history and data-model snapshots.
- Parsing JSON or streaming SSE responses.
- Pushing validated A2UI messages into the store in order.
- Forwarding `onAction` payloads back to the agent.
- Cancelling stale requests and surfacing errors.

It should not own:

- Rendering A2UI components directly.
- Mutating the generated component tree by hand.
- Trusting arbitrary prose from the model as UI.
- Letting browser clients override provider credentials in production.

### Interface Best Practices

Keep the transport small and explicit:

```ts
import type { MessageStore, UserActionPayload } from '@lynx-js/a2ui-reactlynx';

interface ConversationContext {
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  dataModel: Record<string, unknown>;
}

interface A2UITransport {
  generate(input: {
    prompt: string;
    conversation?: ConversationContext;
    signal?: AbortSignal;
  }): Promise<unknown[]>;
  respondToAction(input: {
    surfaceId: string;
    action: UserActionPayload;
    conversation?: ConversationContext;
    signal?: AbortSignal;
  }): Promise<unknown[]>;
}

async function applyMessages(
  store: MessageStore,
  messages: unknown[],
): Promise<void> {
  for (const message of messages) {
    store.push(message);
  }
}
```

This keeps generated UI as data until the last step. The renderer remains the
only place that interprets A2UI messages.

### REST Baseline

Use routes such as `/api/a2ui/chat` and `/api/a2ui/action` when you want a
simple request/response implementation:

```ts
function extractMessages(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'string') {
    try {
      return extractMessages(JSON.parse(payload));
    } catch {
      return [];
    }
  }
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as {
    messages?: unknown;
    validation?: { messages?: unknown };
    text?: unknown;
  };
  if (Array.isArray(record.messages)) return record.messages;
  if (Array.isArray(record.validation?.messages)) {
    return record.validation.messages;
  }
  if (typeof record.text === 'string') return extractMessages(record.text);
  return [];
}

async function postA2UI(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`A2UI request failed: ${response.status}`);
  }

  const messages = extractMessages(payload);
  if (messages.length === 0) {
    throw new Error('A2UI response did not include renderable messages');
  }
  return messages;
}
```

Then wire it to the renderer:

```ts
async function generate(prompt: string, signal?: AbortSignal) {
  const messages = await postA2UI(
    '/api/a2ui/chat',
    { messages: [{ role: 'user', content: prompt }] },
    signal,
  );
  await applyMessages(store, messages);
}

async function respondToAction(
  action: UserActionPayload,
  signal?: AbortSignal,
) {
  const messages = await postA2UI(
    '/api/a2ui/action',
    { surfaceId: action.surfaceId, action },
    signal,
  );
  await applyMessages(store, messages);
}
```

### SSE Streaming

Use routes such as `/api/a2ui/stream` and `/api/a2ui/action/stream` when you
want to show generation progress. The server emits:

- `delta`: raw model text, useful for an inspector or loading state.
- `repair`: optional metadata when the server had to repair invalid model
  output.
- `done`: the final validated payload. Use the messages from this event for
  rendering.
- `error`: structured failure payload.

```ts
interface SseFrame {
  event: string;
  data: unknown;
}

function parseSseFrame(frame: string): SseFrame | null {
  const lines = frame.split(/\r?\n/u);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

async function readA2UISse(
  response: Response,
  onDelta?: (text: string) => void,
): Promise<unknown[]> {
  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = '';
  let generatedText = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/u);
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === 'delta') {
        const text = (parsed.data as { text?: unknown }).text;
        if (typeof text === 'string') {
          generatedText += text;
          onDelta?.(generatedText);
        }
        continue;
      }

      if (parsed.event === 'done') {
        const messages = extractMessages(parsed.data);
        if (messages.length === 0) {
          throw new Error('A2UI stream finished without renderable messages');
        }
        return messages;
      }

      if (parsed.event === 'error') {
        throw new Error(JSON.stringify(parsed.data));
      }
    }

    if (done) break;
  }

  return extractMessages(generatedText);
}
```

Avoid rendering every `delta` as A2UI. During streaming, the model text may be
an incomplete JSON array. Render from the final `done` event by default. If you
choose partial rendering, only publish complete parsed message objects and
replace them with the final validated messages when `done` arrives.

## Operational Best Practices

- Keep one active generation per conversation surface. Abort or ignore older
  requests when a new prompt starts.
- Use a separate `AbortController` for user actions. An old action response
  should not update the UI after a newer action has started.
- Render from `done.validation.messages` or `messages`. Treat `delta` as
  progress text for inspectors and loading states.
- Push messages into `MessageStore` in server order. Do not sort, merge, or
  deduplicate them unless you understand the protocol consequences.
- Keep conversation history and the current data-model snapshot outside
  `MessageStore`; include them in the next agent request when you need coherent
  multi-turn updates.
- Send action requests with both `surfaceId` and the full `action` payload.
  Action responses normally update the existing surface rather than creating a
  new one.
- Normalize all supported response formats: direct arrays, `{ messages }`,
  `{ validation: { messages } }`, and stringified JSON.
- Check `content-type`. Your endpoints may return JSON or `text/event-stream`
  depending on the route.
- Parse non-2xx responses as structured JSON when possible, then fall back to a
  status-based error.
- Keep endpoint allowlists strict. The hosted Playground should only talk to
  trusted GenUI endpoints.
- Do not pass model API keys, base URLs, or model ids from a browser in
  production. Keep provider selection and credentials on the server.
- Configure CORS and rate limits on the server before exposing the agent to
  browsers.
- Version your catalog contract. The agent catalog and client catalog must
  agree on component names and props, or validated output may still render as
  unsupported on the client.
- Use deterministic mocks for tests. A transport can be an in-process async
  generator that pushes known A2UI messages into the store.

Common mistakes:

- Rendering raw model prose instead of validated A2UI messages.
- Reusing one `MessageStore` for unrelated conversations without remounting
  `<A2UI key={...}>`.
- Dropping `conversation.dataModel`, which makes follow-up actions lose state.
- Retrying non-idempotent actions automatically, which can apply the same user
  intent twice.
- Allowing generated image URLs, remote endpoints, or provider overrides from
  untrusted browser input.

## Try The Playground

The hosted playground is the fastest way to see the whole loop before
integrating it into an app:

[https://lynx-stack.dev/a2ui/](https://lynx-stack.dev/a2ui/)

Use the hosted page to try the demos, inspect generated A2UI JSON, browse the
catalog, and preview Lynx surfaces.

Use the playground to:

- Describe UI in natural language and inspect the generated A2UI JSON.
- Browse the component catalog like a React component library.
- Preview the generated Lynx surface.
- Test action flows such as submit, refresh, and selection.
- Generate preview URLs and QR codes for native Lynx testing.

## Glossary For React Developers

| GenUI term         | React-friendly meaning                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| A2UI               | JSON messages that describe UI changes. Similar to a serialized, constrained UI tree.  |
| Surface            | A generated UI root, similar to a mounted app region.                                  |
| Catalog            | The approved component library and prop schema exposed to the agent.                   |
| `MessageStore`     | Append-only external store that receives protocol messages.                            |
| `updateComponents` | "Render these component instances with these props."                                   |
| `updateDataModel`  | "Patch the data used by bound props." Similar to remote state updates.                 |
| Action             | A generated UI event, similar to `onClick`, sent back to the agent as structured data. |

## Protocol Notes

The current A2UI path targets A2UI v0.9.

- The model must output a raw JSON array, not Markdown.
- A fresh response starts with `createSurface`, followed by
  `updateComponents` containing a `root` component.
- Components form a flat graph. Children are referenced by id rather than
  inlined.
- Data bindings use JSON Pointer paths and must be populated by
  `updateDataModel`.
- Interactive components emit action payloads. The client posts those actions
  to the agent, and the agent returns update messages for the existing surface.

## Testing And Quality

Use your app's normal test runner. The high-value checks are:

- Unit-test catalog registration so every component name in generated messages
  maps to the ReactLynx component you expect.
- Unit-test transport parsing with deterministic JSON and SSE fixtures,
  including malformed responses and aborts.
- Replay saved A2UI message arrays through `<A2UI>` so renderer regressions are
  visible without calling a model.
- E2E-test one prompt flow and one action flow with mocked agent responses
  before adding model-backed tests.

## Product Direction

GenUI is designed around a few commitments:

- React remains the implementation layer. The agent chooses from components you
  own.
- The catalog is the product contract. It keeps generated UI aligned with your
  design system and platform constraints.
- Progressive rendering should make the UI useful before a turn fully
  completes.
- Transports are replaceable. REST, SSE, WebSocket, A2A, AG UI, or MCP can all
  carry the same A2UI messages.
- Generated UI should be inspectable, replayable, and judgeable in automated
  workflows.

Start with the hosted Playground, then generate a small catalog in your app and
wire one prompt route plus one action route before expanding to richer
components.
