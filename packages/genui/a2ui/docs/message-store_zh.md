# MessageStore 行为

`MessageStore` 连接业务传输层与 `<A2UI>`。增量协议消息使用 `push`，最终完整响应使用
`replace`；只想丢弃已缓存的消息时使用 `clear`。

Store 保存原始消息；`<A2UI>` 持有消息处理后产生的 surface、组件资源和数据模型。
两者是分开的：清空消息 buffer 不会清空界面，用户输入也可以改变实时数据模型而不向 buffer
追加消息。

## 操作对照

| 操作                                      | 原始消息 buffer                      | 对已挂载 `<A2UI>` 的影响                              |
| ----------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `createMessageStore()`                    | 初始为空。                           | surface 就绪前显示 `renderEmpty`。                    |
| `createMessageStore({ initialMessages })` | 复制传入的数组。                     | 挂载后处理这些消息。                                  |
| `push(message)` / `push(messages)`        | 按顺序追加消息。                     | 在已有状态上应用追加的协议操作。                      |
| `replace(fullMessages)`                   | 整体替换数组。                       | 构建目标状态，与当前状态做 diff 并对齐。              |
| `replace([])`                             | 变为空数组。                         | 移除全部 surface，回到 `renderEmpty`。                |
| `clear()`                                 | 变为空数组。                         | 保留当前 surface 和本地状态，后续 `push` 作用于它们。 |
| `getSnapshot()`                           | 返回当前只读数组。                   | 不触发消息处理或渲染。                                |
| `subscribe(callback)`                     | 监听 buffer 变化，返回取消订阅函数。 | 不直接监听用户输入或组件 state。                      |

`push`、`replace` 和 `clear` 均返回 `void`，同步修改 buffer。方法返回不代表渲染完成，
也不代表替换已通过协议检查。非空 `push` 每次通知一次订阅者，`replace` 每次通知一次，
`clear` 在 buffer 非空时通知一次。`push([])` 和清空已为空的 buffer 都不产生通知。

两次修改之间，`getSnapshot()` 返回同一个数组引用。Store 在修改后首次读取时才复制并冻结数组，
因此应在需要消息时读取，而不是每次 `push` 都读取。Store 不会深拷贝或深冻结消息对象。提交后的消息及嵌套 JSON 应保持不可变，后续更新创建新值。原始快照不包含
用户本地输入，不能当作全部实时 UI 状态的导出。

## 流式消息与尾帧全量

下面先追加流式更新，再用完整尾帧替换消息历史：

```tsx
import { A2UI, Text, createMessageStore } from '@lynx-js/genui/a2ui';
import type {
  CatalogComponent,
  ServerToClientMessage,
} from '@lynx-js/genui/a2ui';

const catalogId = 'example';
const catalogs = [Text as CatalogComponent];
const store = createMessageStore();

function fullResponse(text: string): ServerToClientMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId: 'answer',
      catalogId,
      components: [{ id: 'root', component: 'Text', text }],
    },
  }];
}

store.push(fullResponse('正在生成…'));
store.push({
  version: '1.0',
  updateComponents: {
    surfaceId: 'answer',
    components: [{ id: 'root', component: 'Text', text: '部分回答' }],
  },
});
store.replace(fullResponse('完整回答'));

<A2UI
  messageStore={store}
  catalogs={catalogs}
  catalogId={catalogId}
  renderEmpty={() => <text>等待内容</text>}
/>;
```

实际业务中，这些调用随传输层响应到达而执行。REST 响应如果是完整快照，使用 `replace`；
如果是对已有 surface 的更新，使用 `push`。SSE 中先追加经过校验的增量信封，再以最终校验后的
`done` 内容作为全量替换来源。

请求取消由传输层负责：使用 `AbortController` 取消过期的 prompt 和 action 请求，并忽略上一轮的
迟到响应。不要向客户端暴露模型服务凭据，也不要接受不可信的 endpoint 覆盖。Store 不管理请求，
也不判断哪一份响应属于当前轮次。

## `push` 的语义

`push` 追加协议操作。必须先创建 surface，再发送组件或数据更新。对已有 surface 重复发送
`createSurface`，且中间没有删除该 surface，会被拒绝。

`updateComponents` 按 ID 新增或更新本次提供的组件，未提供的 ID 继续保留。每个提供的组件都是
该组件的新描述，不是只合并部分 props 的 patch。与当前描述完全相同的组件视为重发：不通知任何
资源，组件函数也不会重新执行。确实变化的组件会被通知；当它是新出现的，或其 `weight`、组件类型
变化时，引用它的父节点也会被通知。因此组件可以跨消息以任意顺序到达，父子双方都存在后子节点
即会渲染。

值与当前相同的 `updateDataModel` 同样是空操作。模板实例只在模板路径上的条目，或模板自身的组件
发生变化时才会重建。

`updateDataModel` 替换指定 JSON Pointer 路径上的值；省略路径或使用空路径表示根节点，`null`
表示删除目标值。这是明确的服务端写入，可以覆盖本地输入。下文的本地输入合并规则适用于 `replace`。

一次 `push` 传入多条消息，只通知 buffer 订阅者一次。`<A2UI>` 按调用顺序依次应用每一次 `push`、
`replace` 和 `clear`，同一批次内的多次调用也是如此：先 `replace(fullMessages)` 再 `push(updates)`，
会先应用全量替换，再应用追加部分。无法应用的消息会被上报并跳过，其后的消息照常应用。

Buffer 会保留所有 `push` 的消息，直到下一次 `replace` 或 `clear`。长流应以
`replace(finalMessages)` 结束，或在消息上屏后调用 `clear()` 释放它们。

## 什么才是完整替换

替换消息必须能独立描述状态，每个 surface 的更新之前都应包含 `createSurface`。
可以传完整操作历史，也可以传压缩后的状态快照。只有完整 `components` 数组、没有 surface 创建的
消息仍属于更新，应使用 `push`。

当前界面已经有同 ID 的 surface 不影响替换。目标状态会单独构建，因此替换消息内的一次
`createSurface` 是合法的。错误指的是本次替换消息内部重复创建同一个 surface，且中间没有删除。

目标状态覆盖整个 store。目标中不存在的 surface 会被移除，保留 surface 中缺失的组件 ID 也会被移除。
如果传的是完整历史，早期定义仍参与计算，除非后续操作移除了对应状态。因此，只在最后一条
`updateComponents` 中省略某组件，不会删除历史中已经定义的组件。

### Diff 与组件复用

替换比较消息归并后的状态，不靠消息条数、单纯的对象引用或流式分批方式判断：

- 先按 surface ID 和组件 ID 匹配，再对组件描述做 JSON 递归深比较。对象字段顺序不影响结果，
  数组顺序影响结果。
- 未变化的组件描述和资源会复用。渲染状态和当前 surface 全部相同时，不发布组件资源更新。
- 变化的组件和相关父节点会收到通知；数据绑定更新其消费者，子节点集合变化也可能刷新根节点。
- 父组件更新时，通过 `NodeRenderer` 渲染且描述未变的后代不会重新执行；以其他方式渲染子节点的
  catalog 组件仍会带动它们执行。

当前 surface 和根资源身份保留时，不整体重挂载。替换到另一个 active surface，或重建根资源时，
会重置渲染子树。组件类型、父级结构变化也可能重置局部 state；同一 UI 实体应尽量保持 ID 稳定。

构建、比较完整目标状态仍然有计算成本。`replace` 适合完整响应，不能保证工作量只与变化字段数量有关。

依赖子节点描述的父节点，通过 catalog 中的 `ComponentId` / `ChildList` 引用 schema 识别。
没有 schema 时识别内置的 `child`、`children`、`trigger`、`content` 和 `tabs[].child` 字段。
自定义子节点属性应在 schema 中声明。恰好等于组件 ID 的普通文字或 metadata 不属于引用。

### 本地输入与数组

替换会比较旧服务端数据、新服务端数据和包含本地编辑的实时数据：

| 服务端变化         | 替换后的实时数据                     |
| ------------------ | ------------------------------------ |
| 字段未变化。       | 保留当前本地值。                     |
| 字段被修改或新增。 | 应用服务端变化，对象字段递归合并。   |
| 字段被删除。       | 删除该字段，包括该路径上的本地编辑。 |

数组发生变化时按以下规则匹配：

1. 如果三个数组都具有唯一的字符串或有限数值 `id`，按 `id` 匹配；否则尝试满足同样要求的唯一 `key`。
2. 匹配项中，服务端未修改的字段保留本地编辑。新服务端数组决定排列顺序和成员，包括新增、删除的项。
3. 没有可用标识时，只有三个数组长度一致才按下标合并；长度不一致则用服务端数组整体替换。

例如，服务端修改了 A 项，B 项的 `label` 未变，只要 B 能匹配，用户编辑的 B 项 `label` 就会保留。
可重排集合应提供稳定标识，下标无法识别业务项是否移动。这些规则保留的是数据模型中的值，
不保证列表重排时所有组件实例都能保留。

## 替换失败与恢复

Processor 会先在独立状态中检查替换消息，再修改实时状态。只要处理过程中报告协议错误，
整次替换就会被拒绝。常见原因：

| 原因                                     | 错误                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| 缺少 `version`，或版本不是 `"1.0"`。     | `UNSUPPORTED_VERSION`                                                      |
| 更新或删除本次替换中尚未创建的 surface。 | `VALIDATION_FAILED`：`Surface must be created exactly once before updates` |
| 在本次替换中重复创建已有 surface。       | `VALIDATION_FAILED`：`Surface already exists`                              |
| 不满足 catalog 对父子组件组合的限制。    | `UNALLOWED_PARENT` 或 `UNALLOWED_CHILD`                                    |

拒绝后保留当前界面和消费位置。原始 buffer 已经变成失败的快照，因此 `getSnapshot()` 可能与当前
画面对应的状态不同。追加在失败快照后的消息不会直接应用到旧状态。拒绝只上报一次：后续 `push`
既不会修复失败的快照，也不会再次校验它。

Renderer 会输出：

```text
[a2ui] Replacement rejected; keeping the previous rendering state. Correct the full snapshot with replace().
```

在 `<A2UI onMessage={...}>` 中检查 `message.error` 的 `code`、`message`，以及存在时的
`surfaceId` / `path`，可以获得具体原因。这条 warning 只是摘要；其他协议事件仍按业务需要交给传输层转发。

恢复方式二选一：

```ts
// 提交修正后的完整快照，包含 surface 创建。
store.replace(correctedFullMessages);

// 或者丢弃失败 buffer，继续更新保留的界面。
store.clear();
store.push(updatesForExistingSurfaces);
```

`clear()` 不重置协议状态，继续向保留的 surface 重复发送 `createSurface` 仍然非法。
完整响应应使用 `replace`。

`store.replace()` 返回 `void`，不执行同步消息校验。直接使用 `MessageProcessor.replaceMessages()`
时，成功返回 `true`，协议拒绝返回 `false`。传输层仍应校验所有输入；这里的协议检查不能替代对
任意错误 JSON 结构的全面校验。

## RPC、空态与 session 生命周期

替换会忽略 `callRendererFunction` 和 `agentFunctionResponse` 信封，避免重放历史调用。
新的 RPC 调用和响应必须使用 `push`，即使它们随传输层尾帧一起到达。只通过 `replace` 提交的响应，
不会完成对应的待处理调用。

| 场景                                            | 渲染行为                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| 非 null store 尚无 active render resource。     | 调用 `renderEmpty`，默认返回 `null`；包括初次等待 `root` 组件到达的阶段。 |
| `replace([])`，或成功替换后没有可渲染 surface。 | 调用 `renderEmpty`。                                                      |
| 已有内容时调用 `clear()`。                      | 保留当前内容和本地状态。                                                  |
| `push(deleteSurface)` 删除当前 surface。        | 画面留空，不回显旧 surface，也不调用 `renderEmpty`。                      |
| `push` 让另一个 surface 可以渲染。              | 使用普通组件 diff 切换，不强制重挂载整棵子树。                            |
| `replace` 改变当前 surface。                    | 选择替换消息中最后进入可渲染状态的 surface，并重置渲染子树。              |
| `messageStore={null}`。                         | 不渲染内容，也不调用 `renderEmpty`，结束当前挂载的 session。              |

`renderEmpty` 是渲染函数，可能执行多次；`renderFallback` 则用于已有资源处于 pending 的加载态。

从 `null` 变为非 null store 会启动新 session，并消费该 store 中缓存的消息。
直接把一个非 null store 换成另一个非 null store 不会重置 session：渲染器会像 `replace` 一样
对齐到新 store 的内容，未变化的组件保持挂载，新 store 中已有的 RPC 消息不会重放。新 turn 应使用
新的 store 及对应的 `<A2UI key={turnId}>`，详见[概览](./overview_zh.md)。
