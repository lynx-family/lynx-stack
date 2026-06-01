# A2UI playground examples

Reference implementations that intentionally live **outside**
`@lynx-js/genui/a2ui`. The package itself ships only:

- `<A2UI>` — the protocol-naive renderer.
- `MessageStore` — a pure raw-message buffer.
- The catalog + custom-component-author API.

Everything else — talking to an agent, chunking turns, theming the chat
shell — is the developer's choice. These examples show common shapes;
copy and adapt them.

## `io-mock/`

`createMockAgent(store, opts)` returns a driver that pushes a fixed
initial stream into the store and serves canned responses to user
actions. Used by the playground's `lynx-src/App.tsx` to exercise demos
without a real agent.

```ts
const store = createMessageStore();
const agent = createMockAgent(store, { initialMessages, actionMocks });
agent.start(); // streams initial messages into the buffer
agent.onAction(action); // pushes the canned response to a user action
```

## Supabase Storage payload publishing

The A2UI server keeps AI-generated preview URLs short by uploading final
validated `messages` to Supabase Storage before emitting the `done` SSE event.
The playground still receives the full `messages` for immediate rendering, and
uses `done.preview.messagesUrl` for Web Preview and Native Preview links.

To test this locally, create a public bucket for preview payloads and start the
server with Supabase S3 credentials:

```bash
SUPABASE_URL=https://koaijebcyqjpnvxajqhe.supabase.co \
SUPABASE_S3_ACCESS_KEY_ID=<s3-access-key-id> \
SUPABASE_S3_SECRET_ACCESS_KEY=<s3-secret-access-key> \
SUPABASE_STORAGE_BUCKET=genui \
pnpm dev
```

`SUPABASE_STORAGE_BUCKET` defaults to `genui`, and
`SUPABASE_STORAGE_PREFIX` defaults to `a2ui`.
`SUPABASE_STORAGE_REGION` defaults to `us-east-1`. The server writes through
Supabase's S3-compatible Storage endpoint:

```text
a2ui/<id>/messages.json
```

Those objects must be in a public bucket and CORS-readable by the preview
runtime.

In local playground development, generated preview links use the playground
dev server's in-memory payload store by default. Set
`A2UI_PLAYGROUND_CLIENT_PAYLOAD_PUBLISH=0` when you want local development to
exercise the server-side Supabase upload path instead. Production builds do
not enable the dev-server payload store.

## Multi-turn chat shell pattern

For chat UIs, give each turn (user prompt + agent response) its own
`MessageStore` and render one `<A2UI messageStore={turnStore}>` per
agent turn. The shell only tracks turns; the renderer handles
everything inside an agent turn.

```tsx
function Conversation({ catalogs, respond }) {
  const [turns, setTurns] = useState([]);
  const send = async (input) => {
    const store = createMessageStore();
    setTurns((t) => [
      ...t,
      { kind: 'user', content: input },
      { kind: 'agent', store },
    ]);
    await respond(input, store);
  };
  return turns.map((t) =>
    t.kind === 'user'
      ? <view key={...}><text>{t.content}</text></view>
      : <A2UI key={...} messageStore={t.store} catalogs={catalogs} />
  );
}
```

Each `<A2UI>` only sees a bounded buffer; history is just a list of
turns the shell maintains.
