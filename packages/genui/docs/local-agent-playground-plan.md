# GenUI 本地 Lynx XML Agent Playground 规范

## 产品目标

公开命令如下：

```text
genui playground [--port <number>] [--no-open] [--data-dir <path>]
```

命令以前台进程启动本地 Daemon、控制页面和隔离的 Lynx XML Preview，
并调用用户机器上已经安装和登录的 Coding Agent。它不复制通用 Agent
能力，而是复用用户现有的认证、模型、Skills、Hooks、MCP、规则和工具。

本地链路与现有托管 Playground/Mastra 链路共享无状态 React 视图和 CSS，但
运行时相互独立。两者不共享 controller、transport、会话、鉴权、数据目录或
运行状态，现有线上 Mastra、IndexedDB、Share/Delete 和路由行为保持不变。

当前运行平台是 macOS。其他平台启动时返回明确错误。产品不支持远程访问、
自定义 Agent 插件、多个并行 active turn，也不为用户信任的本地 Agent 提供
额外 OS 沙箱。

## UI 复用边界

Hosted 与 Local 编译同一套私有 `shared-ui` React 视图和 canonical CSS。共享
边界包含 Playground chrome、conversation list、chat workspace、transcript、
composer、artifact viewer、Preview shell、Preview viewport 和 Examples 页面。
共享组件只接受 UI-neutral view model、callback 和渲染注入点，不读取 Mastra、
GenUI Server、IndexedDB、Daemon 或本地文件。

Hosted `ChatController` 继续拥有线上 Mastra streaming、IndexedDB、分享、删除、
导入和 hosted preview。Local 使用独立 `LocalAgentChatController`，只管理 Daemon
snapshot/SSE、Agent session、turn、审批、取消和 artifact。Local 浏览器源码只能
通过 `shared-ui` barrel 导入 hosted 源码，不能导入 hosted controller、storage、
server config 或 protocol adapter，也不能把 Daemon transport 伪装成 Mastra adapter。

Local 专属 UI 仅包括 Agent/model/effort、审批操作、Stop 状态、本地错误和隐私
文案，并使用 `localAgent*` 类名。Agent、Model、Effort 按此顺序位于同一个共享
composer pill，Model 只允许从 Daemon 动态目录选择，不提供文本输入。Create、
Examples、conversation layout、视觉层级、
移动端布局和 light/dark theme 与 Hosted 共用实现。Local 支持 New、Switch 和
Rename；Share/Delete 保留同一位置但禁用，并提供 tooltip 与 ARIA。

Local 在 React mount 前消费 URL fragment 完成 bootstrap，建立 HttpOnly session、
保存 CSRF 并清理 fragment。Daemon 是唯一状态源；Local 不建立 IndexedDB 镜像，
不请求 GenUI Server/Mastra endpoint。Hosted 不请求本地 `/api/*`。

## Agent 边界

支持的 Agent ID 和启动协议固定为：

| Agent ID | 产品名称     | 启动协议                     |
| -------- | ------------ | ---------------------------- |
| `codex`  | Codex        | `codex app-server --stdio`   |
| `claude` | Claude Code  | `claude -p` 双向 stream JSON |
| `cursor` | Cursor Agent | `cursor-agent acp`           |
| `trae`   | Trae CLI     | `traecli acp serve`          |

`AgentId` 只接受这四个值。`/api/agents` 只返回 `{ agents }`，每个 descriptor
只包含名称、命令、协议、安装状态、认证状态、effort 和 capability，不携带静态
模型列表。可用性由可执行文件、认证状态和实际协议行为决定。

`GET /api/agents/:agentId/models` 在已鉴权的 Control origin 内按需发现模型。
Codex 通过 app-server 分页 `model/list`，Cursor 通过 `--list-models`，Trae 通过
`models --json`；Claude 不执行探针并返回 default-only unsupported 状态。目录缓存
60 秒并去重并发请求，单次探针限制为 10 秒、1 MiB 输出和 256 个选项，结束后
清理完整 detached process group。非空 model 在启动前必须存在于当前目录；缓存
未命中时强制刷新一次，仍不存在则拒绝 turn。空值始终继承 Agent 默认配置。

Playground 不自动安装或登录，不修改 Agent 配置，不使用 PTY 抓取，不添加
`yolo`、`force`、`bypass` 或自动批准参数。浏览器只处理 Agent 实际上报的
permission request；用户已有配置可能使某些工具无需浏览器询问。

## CLI、Daemon 与单实例

- 默认控制端口为 `58321`；`--port` 可覆盖。
- 默认数据目录位于 macOS Application Support；`--data-dir` 可覆盖。
- 同一数据目录只允许一个 Daemon。私有 lock metadata 和 `0600` Unix socket
  用于单实例协调。
- 首次启动生成短期一次性 bootstrap URL。第二次启动通过 Unix socket 向现有
  Daemon 请求新的 URL，然后打开或打印它并退出。
- lock 只保存 PID、端口、socket 路径、实例 ID 和启动时间，不保存凭据。
- stale lock 只在 PID 已退出且 socket 不可用时回收；存活实例不可覆盖。
- `Ctrl+C`、Daemon 关闭和 turn 取消都必须清理所管理的整个进程组。

Daemon、Local controller、bootstrap 和 Preview runtime 由 `packages/genui/cli`
拥有。CLI 构建直接编译 hosted Playground 的私有 `shared-ui` 源码和 canonical
CSS 到 `cli/dist/playground`，不增加运行时 workspace 依赖，也不形成 package 环。
发布 tarball 自包含构建产物，不依赖 private workspace 才能运行。

## 控制 API

除一次性 bootstrap 外，所有 `/api/*` 请求都需要 host-only、HttpOnly、
SameSite=Strict cookie。状态变更还需要内存 CSRF token。Daemon 不启用 CORS，
并严格校验 Host 和 Origin。

```text
GET   /api/agents
GET   /api/conversations
PUT   /api/conversations/:conversationId
GET   /api/conversations/:conversationId
PATCH /api/conversations/:conversationId
PUT   /api/conversations/:conversationId/sessions/:sessionId
PUT   /api/conversations/:conversationId/turns/:turnId
GET   /api/conversations/:conversationId/events?after=<sequence>
PUT   /api/conversations/:conversationId/approvals/:requestId
PUT   /api/conversations/:conversationId/turns/:turnId/cancellation
GET   /api/conversations/:conversationId/artifacts/:revision
```

浏览器生成 RFC 4122 UUID 形式的 conversation、session 和 turn ID。相同 ID
和相同规范请求幂等返回原结果；冲突复用返回 `409 ID_CONFLICT`。所有可能
产生 Agent、shell、MCP 或网络副作用的请求，必须先持久化资源和 canonical
request hash。

Daemon 全局只允许一个 active turn，并在受管进程完全退出前持有槽位。
控制 UI 只对结构化 `409 ACTIVE_TURN_EXISTS` 重试，复用完全相同的 turn UUID
和请求体，从 100ms 指数退避到 1s，总预算 15s。用户在 admission 完成前点击
取消时，UI 保存 cancellation intent，并在该 turn 被接受后立即取消同一 ID。
稳定的 header cancel control 必须绑定明确的 conversation 和 turn ID。

审批只接受 `allow_once` 或 `deny`。重复相同决定幂等，冲突决定返回 409。
取消接口幂等；取消响应必须包含请求对应的 turn 和当前状态。

## 状态、事件与恢复

Daemon 是事实源。每个 conversation 使用以下结构：

```text
sessions/<conversationId>/
  session.json
  events.jsonl
  turns/<turnId>.json
  artifacts/<revision>.lynxml
```

数据目录逐级使用 `lstat` 创建和校验。请求路径的任意祖先、数据根目录或内部
路径只要是 symlink 就明确失败，不能通过 `realpath` 静默接受。目录权限为
`0700`，文件、lock 和 socket 为 `0600`。

持久化只接受当前唯一结构，不保存格式代号，也不做旧实验数据迁移。恢复时
严格校验字段、类型、UUID、Agent ID、turn 状态和事件单调性。无效记录保持
原样、不删除、不重写，并被跳过；控制页面展示通用恢复警告。崩溃前仍 active
的 turn 恢复为 `interrupted`，绝不自动重跑。

事件使用 conversation 内单调 sequence。durable 事件落盘后才通过 SSE 发布；
snapshot 返回当前 sequence、pending approvals 和分页元数据，浏览器从该
sequence 建立 SSE。thinking、原始工具参数、完整工具输出和 secret 不落盘，
只保留有界、脱敏的用户可见摘要。半写 JSONL 尾行可截断恢复。

上下文重建按以下顺序组成：Lynx XML system prompt、最新完整 artifact、初始
请求，以及最多 64 KiB 的可见 user/assistant 历史。thinking、工具、审批和
副作用事件不进入 prompt；发生截断时生成明确告警。

## Artifact 与 turn lease

最终 assistant response 是唯一权威 artifact。Adapter streaming 只更新
turn-local buffer 和 UI，不通过文件 watcher 或共享工作文件提交结果。

1. Daemon 先持久化 accepted turn 和 request hash。
2. turn 进入 `starting`、`running`，必要时进入 `awaiting_approval` 或
   `cancelling`。
3. 最终响应经共享 Lynx XML contract 提取、规范化、校验，最大 2 MiB。
4. 只有仍持有 active lease、未取消且没有终态的 turn 才能原子写入新的单调
   revision，并发布 durable `artifact.ready`。
5. 无效或超限输出、失败和取消保留上一有效 revision。
6. turn 进入任一终态后永久撤销 lease。迟到 assistant、approval、tool、Hook、
   MCP 或子进程事件全部忽略，不能污染下一个 turn。
7. 每个 turn 恰好产生一个 terminal event。

## 协议与进程生命周期

Codex 使用 JSON-RPC app-server，Claude 使用双向 stream JSON，Cursor 和 Trae
使用 ACP。Claude 的完整 Lynx XML system prompt 通过
`--append-system-prompt` 注入一次；其他 Agent 使用原生初始化或 prompt 通道。

协议 reducer 必须：

- 容忍 chunked framing，并对 malformed、duplicate、out-of-order 和未知事件
  fail closed；
- 使用有界 native JSON-RPC request-ID 表；精确重复不产生第二个语义事件，
  相同 ID 的冲突 payload 只产生一个 terminal protocol error；
- 达到容量后不驱逐历史 ID，第一个新 ID 产生 overflow error，后续事件忽略；
- 把每个 native approval identity 稳定映射为唯一浏览器 UUID 和 callback；
- 只在完整原生 handle 存在时先发送协议取消，否则立即进入进程组终止；
- 在短暂 grace period 后终止整个 detached process group，并以 SIGKILL 兜底。

取消开始前先撤销 turn buffer 和 lease。取消 pending approval 时使用协议的
cancellation outcome，不得伪造为用户点击 deny。

## Preview 安全边界

控制面是 `127.0.0.1:<controlPort>`。Preview listener 绑定 IPv4
`127.0.0.1:<previewPort>`，但只接受精确的
`Host: localhost:<previewPort>`；端口由系统动态分配且必须与控制端口不同。

Preview 不设置 Daemon cookie、不提供 `/api/*`、不返回控制面 CORS。控制页
通过跨 origin sandboxed iframe 加载 Preview。每个 revision 创建全新的 iframe
和 browsing context，先撤销旧 message capability 再销毁旧 iframe。

Artifact 只通过 revision-bound、hash-checked、一次性 postMessage capability
传入；双方校验 event source、nonce、conversation、revision、hash、消息结构
和大小。CSP 和 sandbox 禁止外部连接、图片、字体、表单、top navigation、
popup、download 和 object，只开放 Lynx Web Runtime 所需的 self/blob 资源。

控制 API 必须拒绝 Preview Origin、错误 Host、无凭据、无 CSRF 和
`Origin: null`。恶意 Lynx XML 不能读取控制 DOM、cookie、对话或下一 revision，
不能调用 API，也不能向外联网。

Local 只有一个 `IsolatedLynxXmlFrame` 执行入口。生成 artifact、Examples 卡片、
详情页初始示例和编辑后的示例都必须经过该入口。每次 source 或 artifact 改变
都销毁旧 browsing context，并生成新的 iframe identity、nonce 和 hash。iframe
固定使用 `sandbox="allow-scripts allow-same-origin"` 和
`referrerPolicy="no-referrer"`，只加载 `localhost:<previewPort>`。Examples 不创建
Daemon conversation，也不调用 Agent。Local 不能把 `lynxXmlSource` 交给 shared
`PreviewViewport`，否则会在已鉴权 control origin 上执行不可信 XML。

Control 与 Preview 是两个独立构建入口和静态 allowlist。Control origin 不提供
Preview 执行入口；Preview origin 不提供 Control bundle 或 API。

## 资源限制

- prompt 最大 128 KiB；启动 Agent 前拒绝超限输入。
- artifact 最大 2 MiB。
- 单个规范化事件 payload 最大 256 KiB。
- Agent 实际待消费队列最多 10,000 个事件或 16 MiB；单协议 frame 仍为 8 MiB。
- 每个 turn 的 durable event log 最多 10,000 个事件或 16 MiB；已发送的
  transient assistant delta 不计入该累计值。
- 连续 assistant delta 按 16 KiB 或 50 ms 合并。慢 SSE subscriber 单独断开并
  通过 snapshot 重连，不能使 Agent turn 失败。
- conversation list 和 snapshot 使用显式分页和上限。
- 所有超限路径保留上一有效 artifact，并产生唯一终态。

## 验收

功能与确定性证据矩阵：

| 能力                       | 必须存在的证据                                                 |
| -------------------------- | -------------------------------------------------------------- |
| 四 Agent 发现与禁用态      | adapter 与 `/api/agents` 单元测试、控制 UI 选择器检查          |
| 动态模型目录与设置顺序     | CLI 探针/缓存/启动参数、HTTP 和 Agent→Model→Effort UI 测试     |
| generate / iterate         | fake protocol 生命周期测试与 opt-in 真实 Agent probe           |
| Stop 与 admission race     | Engine、同 UUID retry、packaged Playwright 立即取消测试        |
| `allow_once` / `deny`      | JSON-RPC reducer 与 packaged Playwright 用户点击测试           |
| 幂等、恢复与单 active turn | Store、HTTP、Daemon 重启和 process-exit 槽位测试               |
| artifact lease 与迟到栅栏  | final-response、late artifact、连续 turn 反例                  |
| Preview 隔离               | 正式双 origin 拓扑、Host/Origin 测试和恶意 artifact 浏览器套件 |
| 本地文件安全               | symlink 祖先、内部路径、权限和 traversal 反例                  |
| 发布包自包含               | 干净目录 tarball、静态资产、首次与二次 bootstrap 测试          |
| Hosted/Local UI parity     | shared-ui import/CSS ownership、DOM/ARIA/style 和截图 smoke    |
| Local Examples 隔离        | 卡片、初始/编辑详情的 fresh iframe 与零 Agent 调用浏览器测试   |
| 线上链路不回归             | 托管 Playground、server/Mastra 和共享 Lynx XML 输出测试        |

确定性测试覆盖：

- 四个 Agent descriptor、动态模型目录、协议 framing、模型启动参数、最终输出和
  Claude system prompt 注入；
- JSON-RPC exact duplicate、conflicting reuse、capacity overflow 和审批映射；
- generate、iterate、admission retry、立即取消、pending approval 取消、
  `allow_once`、`deny`、唯一终态、迟到事件隔离和无孤儿进程；
- UUID 幂等、请求冲突、崩溃恢复、半写事件、严格当前结构恢复和分页 SSE；
- symlink 祖先、路径穿越、权限、Host、Origin、cookie、CSRF 和 payload 限制；
- control/Preview 正式拓扑及真实 Chromium 恶意 artifact 套件；
- Local 只能导入 `shared-ui` barrel、无第二套 Playground HTML/CSS，Hosted/Local
  共享区域的 DOM、class、ARIA 和 computed style 保持一致；
- Create artifact、Examples 卡片和 Examples 编辑内容全部使用独立 Preview origin，
  且 Examples 不创建 conversation 或调用 Agent；
- 干净目录安装 tarball、静态资产、首次和二次 bootstrap；
- 线上 Playground/Mastra 及共享 Lynx XML 输出契约回归。

真实 Agent probe 是显式 opt-in 行为测试，经过 tarball、Daemon、HTTP/SSE、
控制 UI 和 Playwright，执行四个 Agent 的 generate、iterate、Stop、唯一终态
与进程清理，并如实记录实际出现的审批。报告是诊断产物，产品运行时不读取。
