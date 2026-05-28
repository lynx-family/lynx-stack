# A2UI playground examples

这些 reference implementations 故意放在 `@lynx-js/genui/a2ui` 之外。这个包本身只提供：

- `<A2UI>`：与传输无关的 renderer。
- `MessageStore`：纯 raw-message buffer。
- Catalog APIs、内置组件和协议辅助能力。

其他事情，包括与 Agent 通信、按 turn 组织响应、以及给 chat shell 做主题，都由开发者自己决定。这些 examples 展示的是可以复制和改造的常见形态。

## `io-mock/`

`createMockAgent(store, opts)` 返回一个 driver：它会把固定的 initial stream 写入 store，并对用户 action 返回预设响应。Playground
用它在没有真实 Agent 的情况下驱动 demos。

```ts
const store = createMessageStore();
const agent = createMockAgent(store, { initialMessages, actionMocks });
agent.start(); // 把 initial messages 流式写入 buffer
agent.onAction(action); // 对用户 action 写入预设响应
```

## Multi-turn chat shell pattern

对 chat UI 来说，为每个 turn（用户 prompt + Agent response）创建一个独立的 `MessageStore`，然后为每个 Agent turn 渲染一个
`<A2UI messageStore={turnStore}>`。Shell 只维护 turns；Agent turn 内部的内容交给 renderer 处理。

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

每个 `<A2UI>` 只看到一个有边界的 buffer；历史记录只是 shell 维护的 turn 列表。

## Walkthrough：使用全部内置 catalog entries

当你的包想渲染完整的 A2UI v0.9 内置 catalog 时，可以使用这个接入方式。它与 playground 的
`lynx-src/a2ui/App.tsx` 集成方式一致。

### 1. Agent 侧使用内置 catalog

如果后端使用 prompt helper，直接调用不带 custom catalog 的 `buildA2UISystemPrompt()`：

```ts
import { buildA2UISystemPrompt } from '@lynx-js/genui/a2ui-prompt';

const systemPrompt = buildA2UISystemPrompt();
```

如果你的接入使用 CLI，不传 `--catalog-dir` 生成 prompt：

```bash
genui a2ui generate prompt --out dist/a2ui-system-prompt.txt
```

`packages/genui/server/app/a2ui` 下的 server routes 也默认使用内置 catalog。只有当你明确想用 custom catalog 覆盖内置
catalog 时，才发送 `catalog` request field。

### 2. Lynx Client 侧组合全部内置组件

不存在 `@lynx-js/genui/a2ui/catalog/all` 导出。请把完整列表复制到你的接入点，让 bundler 能看见你具体选择了哪些组件。

```tsx
import {
  A2UI,
  Button,
  Card,
  CheckBox,
  ChoicePicker,
  Column,
  DateTimeInput,
  Divider,
  Icon,
  Image,
  LineChart,
  List,
  Modal,
  PieChart,
  RadioGroup,
  Row,
  Slider,
  Tabs,
  Text,
  TextField,
  basicFunctions,
  createMessageStore,
  normalizePayloadToMessages,
} from '@lynx-js/genui/a2ui';
import type {
  CatalogComponent,
  CatalogInput,
  CatalogManifest,
  MessageStore,
  ServerToClientMessage,
  UserActionPayload,
} from '@lynx-js/genui/a2ui';
import { catalogManifests } from '@lynx-js/genui/a2ui/catalog';

function manifestEntry(
  component: unknown,
  manifest: CatalogManifest,
): readonly [CatalogComponent, CatalogManifest] {
  return [component as CatalogComponent, manifest];
}

export const ALL_BUILTINS: readonly CatalogInput[] = [
  manifestEntry(Text, catalogManifests.Text),
  manifestEntry(Image, catalogManifests.Image),
  manifestEntry(Row, catalogManifests.Row),
  manifestEntry(Column, catalogManifests.Column),
  manifestEntry(List, catalogManifests.List),
  manifestEntry(Card, catalogManifests.Card),
  manifestEntry(Modal, catalogManifests.Modal),
  manifestEntry(Button, catalogManifests.Button),
  manifestEntry(Divider, catalogManifests.Divider),
  manifestEntry(Icon, catalogManifests.Icon),
  manifestEntry(CheckBox, catalogManifests.CheckBox),
  manifestEntry(ChoicePicker, catalogManifests.ChoicePicker),
  manifestEntry(DateTimeInput, catalogManifests.DateTimeInput),
  manifestEntry(LineChart, catalogManifests.LineChart),
  manifestEntry(PieChart, catalogManifests.PieChart),
  manifestEntry(RadioGroup, catalogManifests.RadioGroup),
  manifestEntry(Slider, catalogManifests.Slider),
  manifestEntry(TextField, catalogManifests.TextField),
  manifestEntry(Tabs, catalogManifests.Tabs),
  ...basicFunctions,
];
```

这些 manifests 可在 transport 需要时序列化为 Agent handshake 使用。`basicFunctions` 会注册 A2UI function calls 的客户端实现，例如
`formatDate`、`formatString`、`formatCurrency`、`required`、`email` 和 `and`。

### 3. 把 Agent messages 写入 `MessageStore`

Store 只缓存原始 protocol messages。Fetching、streaming、parsing 和 retry 都由你的 transport 负责。

```tsx
const store = createMessageStore();

function appendMessages(messages: readonly ServerToClientMessage[]) {
  store.push(messages);
}

async function sendPrompt(input: string) {
  const res = await fetch('/a2ui/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: input }] }),
  });

  appendMessages(normalizePayloadToMessages(await res.json()));
}
```

Fixtures 和 demos 使用 playground 的 `examples/io-mock/mockAgent.ts` 中的 `createMockAgent(store, ...)`。生产应用应替换为自己的
transport。

### 4. 渲染并转发 actions

为每个 active response buffer 渲染一个 `<A2UI>`。当 generated UI 触发 action 时，把它发给 Agent 服务，并将返回的 messages 写回同一个
store。

```tsx
function A2UISurface(props: {
  store: MessageStore;
  onAgentAction: (
    action: UserActionPayload,
  ) => Promise<readonly ServerToClientMessage[]>;
}) {
  return (
    <A2UI
      messageStore={props.store}
      catalogs={ALL_BUILTINS}
      className='a2ui-container'
      wrapSurface={(children) => <view className='a2ui-light'>{children}</view>}
      onAction={(action) => {
        void props.onAgentAction(action).then((messages) => {
          props.store.push(messages);
        });
      }}
    />
  );
}
```

对应的 JSON action endpoint 可以用同样方式 normalize response：

```ts
async function onAgentAction(action: UserActionPayload) {
  const res = await fetch('/a2ui/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surfaceId: action.surfaceId,
      action: {
        name: action.name,
        context: action.context,
      },
    }),
  });

  return normalizePayloadToMessages(await res.json());
}
```

如果你想为新 session 或 chat turn 重置 `<A2UI>`，请使用不同的 `key`。组件会在一次 mount 生命周期内持有自己的
`MessageProcessor`。

### 5. 沿用 playground package shape

Playground 把 web control panel 和 Lynx renderer 分开：

- `src/entry.tsx` 渲染浏览器控制面板。
- `src/render.tsx` 注册 `<lynx-view>`，传入 `initData` 或 `globalProps`，并加载 `./a2ui.web.js`。
- `lynx-src/a2ui/App.tsx` 读取 payload，创建 `MessageStore`，把 messages 流式写入其中，并渲染
  `<A2UI catalogs={ALL_BUILTINS}>`。

如果要构造 playground-style preview URL，可以使用 `src/utils/renderUrl.ts`，或传入等价 query parameters：

```txt
/render.html?protocol=a2ui&demoUrl=./a2ui.web.js&demo=recs&speed=0
```

如果 preview 需要 live actions，请设置 `liveAction: true`。Lynx app 会通过 `NativeModules.bridge` 发送
`A2UI_USER_ACTION`；web shell 将它转发给 parent page，parent 再把 `A2UI_ACTION_RESPONSE` messages post 回同一个
Lynx view。
