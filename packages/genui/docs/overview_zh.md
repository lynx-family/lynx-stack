# Lynx GenUI

Lynx Stack 提供四种 Generative UI 接入：A2UI、OpenUI、ReactLynx 和 Lynx XML。A2UI 和
OpenUI 将模型输出视为数据，渲染 Lynx 应用信任的组件；Lynx XML 使用 Vanilla
Lynx 生成完整、可执行的页面产物。

## 选择接入方式

| 组成部分      | A2UI                                        | OpenUI                                           | ReactLynx                     | Lynx XML                           |
| ------------- | ------------------------------------------- | ------------------------------------------------ | ----------------------------- | ---------------------------------- |
| 输出格式      | A2UI v0.9 messages                          | OpenUI Lang v0.5 assignments                     | `App.tsx` + `App.css`         | 独立 `.lynxml` 产物                |
| UI 契约       | Catalog                                     | Library                                          | ReactLynx                     | Vanilla Lynx 与 Element PAPI       |
| Client 输入   | 增量 protocol messages                      | 累计 OpenUI 文本                                 | 编译后的 Web 或 Native bundle | 按需转换、规范化并校验后的最终产物 |
| 主要 renderer | `<A2UI>`                                    | `<OpenUiRenderer>`                               | Lynx 宿主                     | Lynx XML 运行时                    |
| 状态和数据    | Protocol operations 与 client message store | `$variables`、Query、Mutation、Action statements | React 组件和 Hook             | 模型编写的主线程 JavaScript        |
| 适合场景      | Agent 和 transport 已使用 A2UI              | 紧凑的声明式 UI 文本                             | 使用 React 编写完整交互页面   | 包含生成代码和交互的完整页面产物   |

根据 Agent 和宿主支持的能力选择接入方式。A2UI 和 OpenUI 的 Prompt 与渲染端
组件契约必须一致；Lynx XML 需要能够加载 `.lynxml` 的宿主，且 Prompt 与转换
选项一致。每个生成页面应从生成到渲染使用同一种格式。

ReactLynx 生成 `App.tsx` 与 `App.css`，编译为 Web 和 Native bundle 后在 Lynx
宿主中加载，适合用 React 组件和 Hook 编写完整交互页面。
`@lynx-js/genui/reactlynx` 提供 Prompt、源码校验与 Node.js 编译器，后端负责
发布构建产物。

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

### ReactLynx

- [简介](/zh/guide/genui/reactlynx)
- [概览与架构](/zh/guide/genui/reactlynx/overview)
- [源码与构建](/zh/guide/genui/reactlynx/source-guide)
- [System Prompts](/zh/guide/genui/reactlynx/system-prompts)

### Lynx XML

- [简介](/zh/guide/genui/lynx-xml)
- [概览与架构](/zh/guide/genui/lynx-xml/overview)
- [产物与校验](/zh/guide/genui/lynx-xml/artifact-guide)
- [System Prompts](/zh/guide/genui/lynx-xml/system-prompts)

## Playground

可以通过 [GenUI Playground](https://lynx-stack.dev/genui/) 查看内置的 A2UI 和
OpenUI 组件集，也可以生成并预览 ReactLynx 页面和 Lynx XML 产物。
