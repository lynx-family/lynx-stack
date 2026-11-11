# A2UI 1.0 迁移复核

[English](./protocol-1.0-audit.md) | 简体中文

本次复核覆盖从 `c118dd9fd` 到 `9f8404e0a` 的六个迁移提交，包括测试、生成的
Catalog、提示词、示例、传输适配和文档。对照官方提交
[`24d1bf9c830071f74c9c908433e73cc6cbe0aa33`](https://github.com/a2ui-project/a2ui/tree/24d1bf9c830071f74c9c908433e73cc6cbe0aa33)。
官方 [版本清单](https://github.com/a2ui-project/a2ui/blob/24d1bf9c830071f74c9c908433e73cc6cbe0aa33/specification/versions.json)
已将 1.0 标为当前版本；分支之前固定到 `1c45c809b655878d06e3afc6dda22100afecc0a4`。

## 与分支原有契约的差异

| 范围         | 分支原有行为                                       | 当前标准与实现                                                                                                                                       |
| ------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 消息版本     | `"v1.0"`                                           | 双向消息、元数据、示例和提示词统一为 `"1.0"`；拒绝旧版本及缺少版本的消息。                                                                           |
| 动态值       | `path`、`call`                                     | 改为 `@path`、`@call`；普通键作为字面数据；`@@` 只去掉一个前缀；未知指令报错。                                                                       |
| 组件字段     | `catalogId`、`metadata`、`accessibility`、`checks` | 改为 `@catalogId`、`@metadata`、`@accessibility`、`@checks`。Surface/函数的 catalogId、ChildList.path、updateDataModel.path 不加前缀。               |
| Renderer RPC | 没有数据模型作用域                                 | surfaceId 可选；省略时使用隔离的空模型；无效作用域或权限错误通过关联的 rendererFunctionResponse 返回。                                               |
| 函数执行     | 权限和参数检查不完整                               | 检查 allowedCallers、requiresUserActivation、解析后的参数和默认值；无本地实现的 schema 声明可路由给 Agent；action 等待嵌套异步结果，每次发起新调用。 |
| 失败处理     | 部分错误被吞成 undefined 或等到超时                | 动态绑定失败为 null；远程错误关联 functionCallId，本地错误关联 surfaceId；传输拒绝及时结束 RPC。                                                     |
| 校验         | Boolean 和 ValidationResult 行为混杂               | 使用明确的 DynamicBoolean 转换；保留可选 CheckRule.message，以及结果消息优先级、code、severity。                                                     |
| 插值与正则   | 依赖旧 Web 函数包                                  | 使用本地实现；插值继承外层函数 Catalog，支持 @index；正则执行可移植方言、安全静态分析、Unicode 码点和严格结束锚点。                                  |
| Catalog      | 较早的函数和组件结构                               | 当前判别字段、相对 common type 引用；保留用户手势声明，禁止声明保留的 Surface 组件，执行组合约束。                                                   |
| 快照         | 输出内部模板实例上下文                             | 保留协议模板和元数据，不把内部克隆 ID、dataContextPath 当作组件属性输出。                                                                            |
| Playground   | 只转发点击                                         | 转发协议消息和数据模型元数据；全部 Local/Gallery 示例对照固定的官方 schema 和生成的 Lynx Catalog 校验。                                              |

## 按代码区域复核

- `src/store`：生命周期、JSON 子树更新、Catalog 查找、表达式、模板展开、RPC 关联、
  异步值和组合约束。内部资源仍有 beginRendering/surfaceUpdate 名称，它们不是可接收的
  wire 操作，也不是 0.9 兼容分支。
- `src/react`、`src/catalog`：action、校验、组件 Catalog 选择、无障碍属性和序列化。
  action/checks 保留到执行边界才求值；删除旧 Modal 字段别名和嵌套 template 回退。
- `src/functions`：14 个官方 basic 函数和 11 个明确声明的 Lynx 工具函数；后者属于自定义
  Catalog，不代表支持旧协议。删除 0.9 Web SDK 依赖；函数 schema 和正则分析与协议夹具
  固定到同一个上游提交。
- `src/snapshot`：保留 JSON 类型、删除语义、可达组件定义、集合模板和 Surface 扩展元数据。
- `a2ui-catalog-extractor`：组件/函数判别字段、引用类型、Catalog 联合定义、测试夹具和文档。
- `server/agent/a2ui`：当前提示词、消息、Catalog、公共类型、来源检查、流式校验和组合约束；
  严格信封解析拒绝 theme 等已移除字段。
- `server/app/a2ui`：将 renderer 消息与 HTTP 选项分开校验，保留 JSON/SSE RPC 和 action
  元数据；无 Surface 的 renderer 反馈由无状态服务确认接收，不虚构 Surface。
- `playground`、CLI 模板、示例：当前字段、Catalog ID、合法组件 ID、可见错误和 RPC 转发；
  媒体示例使用已实现的链接动作，不再宣称存在 AudioPlayer/Video renderer。
- Bench adapter/runner：版本、消息提取、来源检查和回放夹具使用相同契约，评估行为保持一致。

## 实现范围与宿主职责

发布的是 **Lynx Catalog**，不表示官方 basic catalog 的每个组件都有原生实现。GenUI
服务未安装 Agent 端 Catalog 函数，因此对这类请求返回 UNKNOWN_FUNCTION；宿主可以注册
可信实现。客户端表达式求值不会拉取远程代码或 Catalog 引用。

无障碍 label/description、hidden 映射到 Lynx 属性，Web 属性还携带 live-region 意图。
读屏实际行为取决于宿主平台。openUrl 需要浏览器或宿主提供的原生实现。原生字节码构建
检查不替代真机读屏测试。

回归测试使用固定的官方 schema、本地 mock 和生成的 Catalog，不依赖模型现场输出，
也不宣称通过外部认证项目。

## 验证结果

- 全仓构建：75 个任务通过，包含原生字节码和 Web。
- 相关回归：114 个文件、1,028 个用例通过，包括 8 个 Local Examples 和 35 个 Gallery
  示例的官方 schema 校验。
- client、server、extractor 类型检查通过；API Extractor 的 26 个任务通过。
- 修改文件的 ESLint、Biome、dprint 和 git diff --check 通过；changeset 检查包含预期的
  GenUI minor 发布，并明确标注破坏性变化。
- 不限定范围的全仓 Biome 会扫描 examples/react-debug-metadata/dist-consumer 下被 Git
  忽略的构建产物，报告生成代码错误。本次源码范围检查通过，没有提交这些构建产物。
- Playground 独立 tsc --noEmit 被现有项目引用配置阻止（TS6310）；Web 和原生生产构建通过。
