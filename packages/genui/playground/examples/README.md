# GenUI playground examples

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

## Volcengine TOS payload publishing

The A2UI server keeps AI-generated preview URLs short by uploading final
validated `messages` to Volcengine TOS before emitting the `done` SSE event.
The playground still receives the full `messages` for immediate rendering, and
uses `done.preview.messagesUrl` for Web Preview and Native Preview links.
The playground also uses `PUT /a2ui/payload` and `PUT /openui/payload` when it
needs to publish directly, then treats the returned URLs as opaque values.

The bucket is public-read, but uploads are always authenticated by the GenUI
server. Give a dedicated IAM user only `tos:PutObject` access to the preview
object prefixes, keep its AK/SK in the server environment, and do not expose
those credentials to the playground or another browser client.

To test this locally, create the public-read bucket and start the server with
the write credentials:

```bash
TOS_ACCESS_KEY=<access-key-id> \
TOS_SECRET_KEY=<secret-access-key> \
TOS_BUCKET=genui \
TOS_REGION=cn-beijing \
pnpm dev
```

`TOS_BUCKET` defaults to `genui`, `TOS_REGION` defaults to `cn-beijing`, and
`TOS_STORAGE_PREFIX` defaults to `a2ui`. `TOS_OPENUI_STORAGE_PREFIX` defaults
to `openui`. The native TOS endpoint defaults to
`tos-${TOS_REGION}.volces.com`; set `TOS_ENDPOINT` to a host (an optional
`http://` or `https://` scheme is accepted) when the bucket uses a different
endpoint. An optional `TOS_SECURITY_TOKEN` enables temporary STS credentials.

The server writes objects such as:

```text
a2ui/<id>/messages.json
```

The upload request is signed with the server-only credential and does not set a
public object ACL. Public reads come from the bucket policy. The bucket must
also be CORS-readable by the preview runtime.

In local playground development, generated preview links use the playground
dev server's in-memory payload store by default. Set
`A2UI_PLAYGROUND_CLIENT_PAYLOAD_PUBLISH=0` when you want local development to
exercise the server-side TOS upload path instead. Production builds do
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
