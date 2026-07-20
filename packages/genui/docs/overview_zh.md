# Lynx GenUI

Lynx Stack 提供两种声明式 Generative UI 接入：A2UI 和 OpenUI。两者都会把模型
输出视为数据，并且只渲染 Lynx 应用信任的组件；它们的 wire format 和组件 contract
不同。

## 选择协议

| 组成部分      | A2UI                                        | OpenUI                                             |
| ------------- | ------------------------------------------- | -------------------------------------------------- |
| 协议          | A2UI v0.9 messages                          | OpenUI Lang v0.5 assignments                       |
| 组件 contract | Catalog                                     | Library                                            |
| Client 输入   | 增量 protocol messages                      | 累计的 OpenUI 文本                                 |
| 主要 renderer | `<A2UI>`                                    | `<OpenUiRenderer>`                                 |
| 状态和数据    | Protocol operations 与 client message store | `$variables`、Query、Mutation 和 Action statements |
| 适合场景      | Agent 和 transport 已经使用 A2UI            | Agent 生成紧凑的声明式 UI 文本                     |

应选择 Agent 和 transport 已支持的协议。两个 renderer 可以共存于同一个应用，但
单个 generated surface 必须端到端使用同一种协议。

## 文档目录

### A2UI

- [简介](/zh/guide/genui/a2ui)
- [概览与架构](/zh/guide/genui/a2ui/overview)
- [Catalogs 与组件](/zh/guide/genui/a2ui/catalog-guide)
- [System Prompts](/zh/guide/genui/a2ui/system-prompts)

### OpenUI

- [简介](/zh/guide/genui/openui)
- [概览与架构](/zh/guide/genui/openui/overview)
- [Libraries 与组件](/zh/guide/genui/openui/library-guide)
- [System Prompts](/zh/guide/genui/openui/system-prompts)

## Playground

可以通过 [GenUI Playground](https://lynx-stack.dev/genui/) 查看内置的 A2UI 和
OpenUI 组件集。
