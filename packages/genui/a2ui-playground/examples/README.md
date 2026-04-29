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

## `chat-shell-lynx/`

A multi-turn chat shell built on top of `<A2UI>`:

- Each turn (user prompt + agent response) owns its own `MessageStore`.
- Each agent turn renders one `<A2UI messageStore={turnStore}>` instance.
- Sending a new prompt creates a fresh agent turn and invokes the
  developer's `respond(input, store)` callback to stream into it.

This is the recommended pattern for chat UIs — each `<A2UI>` has a
bounded buffer to process, and history is just a list of turns the shell
maintains.

```tsx
<LynxConversation
  catalogs={[Text, Button, Card]}
  respond={async (input, store) => {
    for await (const msg of myAgent.stream(input)) store.push(msg);
  }}
  onAction={(action, latestStore) => {
    if (!latestStore) return;
    void myAgent.fireAction(action, latestStore);
  }}
/>;
```
