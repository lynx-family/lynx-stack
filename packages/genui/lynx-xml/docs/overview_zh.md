# 概览与架构

Lynx XML 生成完整的 `.lynxml` 文件，其中包含渲染 Vanilla Lynx 页面所需的代码
和样式。`@lynx-js/genui/lynx-xml` 提供生成契约和确定性处理工具，业务提供模型
和运行时。

## 适用场景

A2UI 和 OpenUI 将 UI 表达为数据，由 ReactLynx 应用内的可信组件解释并渲染。
Lynx XML 生成独立、可执行的 UI 源码。如果任务需要包含模型编写的状态和交互的
完整页面产物，且宿主能够加载 `.lynxml` 文件，可以使用 Lynx XML。

无需注册 Catalog 或 Library。生成契约由 System Prompt、选中的转换能力和目标
Lynx 运行时共同定义。

## 职责划分

| 层级        | 职责                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| Prompt 构建 | 描述产物边界、Element PAPI、生命周期、布局和选中的生成能力。             |
| 模型接入    | 提供 System Prompt 和用户请求，管理模型服务、凭证、取消和流式传输。      |
| 产物转换    | 提取完整模型源码，应用启用的 Template、ScriptReuse 和 StylePreset 转换。 |
| 产物处理    | 提取、规范化最终产物，并校验产物结构契约。                               |
| Lynx 运行时 | 执行生成的脚本并渲染页面。                                               |
| 业务应用    | 保存原始输出和最终产物，管理预览、失败和修复流程。                       |

## 处理流程

```text
用户请求 + buildLynxXmlSystemPrompt(options)
  → 业务模型调用
  → 完整模型响应
  → 启用转换能力时调用 assembleLynxXmlArtifact(response, options)
  → normalizeLynxXmlArtifact(finalSource)
  → 独立 .lynxml 产物
  → Lynx XML 渲染器
```

原始流式增量可用于展示生成进度。预览或交付前，对完整响应执行转换。Direct
模式关闭全部转换能力时，可以直接从模型响应中提取、规范化并校验产物。

转换在本地完成，不执行生成的 JavaScript，也不增加模型请求。它会进行所启用
能力需要的语法和契约检查。产物处理检查最终产物的结构契约，执行和渲染由运行时负责。

## 生成模式

| 模式           | 模型输出                                                | 业务处理                       |
| -------------- | ------------------------------------------------------- | ------------------------------ |
| Direct（默认） | 完整 `.lynxml` 产物，包含模型编写的 Element PAPI 代码。 | 规范化并校验后渲染。           |
| Template       | 含一个初始元素树 `<template>` 的中间产物。              | 转换模板，规范化并校验后渲染。 |

Template 以确定性方式转换静态元素树。状态和交互仍由模型编写；未启用 ScriptReuse 时，
生命周期注册也由模型负责。

生成契约面向主线程：页面状态、UI 交互和生命周期回调放在一个
`<script thread="main">` 中。Prompt 省略后台执行和跨线程指令。这一生成策略不
改变现有解析器或渲染器对后台脚本的支持。

## 独立的转换能力

| 能力        | 选项                       | 从模型输出移到转换阶段的职责                                           |
| ----------- | -------------------------- | ---------------------------------------------------------------------- |
| Template    | `enableHtmlFragment: true` | 将初始 XML 元素树转换为 Element PAPI JavaScript。                      |
| ScriptReuse | `enableScriptReuse: true`  | 将业务回调转换为包含公共页面、生命周期、事件和 UI 辅助逻辑的完整脚本。 |
| StylePreset | `stylePreset: 'default'`   | 将内置工具类引用转换为自包含 CSS。                                     |

包 API 中三个能力均独立、默认关闭。Prompt 和转换必须使用一致的选项。
Template 和 ScriptReuse 产物包含中间契约，交给运行时前必须完成转换。

GenUI Create 和新建 Lynx XML Bench 分组默认开启这些能力。已保存的产品设置
和历史兼容行为见[产物指南](./artifact-guide_zh.md)。Design 指导由 GenUI Server
单独组合，不属于本包的转换能力。

## 校验范围

`normalizeLynxXmlArtifact` 是提取、规范化并校验最终产物的公开入口，业务无需
单独调用提取函数。它不保证 JavaScript、CSS、Element PAPI 或渲染正确性，这些
需要通过运行时预览检查。

继续阅读[产物与校验](./artifact-guide_zh.md)、
[System Prompts](./system-prompts_zh.md)，或返回[简介](../README_zh.md)。
