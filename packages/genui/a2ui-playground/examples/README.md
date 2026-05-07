# A2UI playground examples

Reference implementations that intentionally live **outside**
`@lynx-js/a2ui-reactlynx`. The package itself ships only:

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

## `io-sse/`

`createSseAgent(store, { url })` opens an SSE connection and pushes the
parsed `delta` / `complete` events into the store. Roughly the
implementation that used to live inside the package's `BaseClient`,
re-targeted at the dumb-buffer store.

```ts
const store = createMessageStore();
const agent = createSseAgent(store, { url: '/api/agent' });
await agent.send('hello'); // streams response into the buffer
await agent.onAction(action); // forwards a user action over SSE
```

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
