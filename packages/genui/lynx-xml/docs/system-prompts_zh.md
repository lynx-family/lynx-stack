# System Prompts

构建与业务转换流程一致的 Lynx XML 生成指令。本包提供程序化 Prompt 构建 API，
模型调用和服务配置由业务负责。

## 构建 System Prompt

Direct 模式可以使用默认常量：

```ts
import { LYNX_XML_SYSTEM_PROMPT } from '@lynx-js/genui/lynx-xml';
```

也可以自定义引擎版本并追加业务规则：

```ts
import { buildLynxXmlSystemPrompt } from '@lynx-js/genui/lynx-xml';

const prompt = buildLynxXmlSystemPrompt({
  engineVersion: '4.2',
  appendix: '优先使用紧凑的信息层级。',
});
```

`engineVersion` 默认 `4.2`，`enableHtmlFragment: true` 选择 Template 模式，
默认 `false`。`appendix` 放在内置指令之后。

## Prompt 选项

| 选项                 | 默认值  | 用途                                                       |
| -------------------- | ------- | ---------------------------------------------------------- |
| `engineVersion`      | `'4.2'` | 生成产物根节点中的目标引擎版本，接受点分数字格式。         |
| `enableHtmlFragment` | `false` | 生成包含一个初始元素树 `<template>` 的中间产物。           |
| `enableScriptReuse`  | `false` | 生成 `definePage` 回调，转换时补充公共生命周期和事件逻辑。 |
| `stylePreset`        | 关闭    | 设为 `'default'` 时描述内置 Lynx 工具类。                  |
| `appendix`           | 无      | 去除首尾空白后追加业务指令。                               |

Template、ScriptReuse 和 StylePreset 相互独立，转换时使用同样的三个选项：

```ts
import {
  assembleLynxXmlArtifact,
  buildLynxXmlSystemPrompt,
  normalizeLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const options = {
  enableHtmlFragment: true,
  enableScriptReuse: true,
  stylePreset: 'default',
} as const;
const systemPrompt = buildLynxXmlSystemPrompt({
  ...options,
  appendix: '使用用户请求中提供的产品术语。',
});

// 将 systemPrompt 传给模型，再处理完整响应。
const { text } = assembleLynxXmlArtifact(modelOutput, options);
const artifact = normalizeLynxXmlArtifact(text);
```

包 API 默认关闭三个能力。GenUI Create 和新建 Lynx XML Bench 分组默认开启，
产品默认值不改变包 API 默认值。Design 是单独的 Server 能力，不属于
`buildLynxXmlSystemPrompt` 选项。

## 其他 Prompt 导出

| 导出                                   | 用途                                                      |
| -------------------------------------- | --------------------------------------------------------- |
| `LYNX_XML_SYSTEM_PROMPT`               | 默认选项下的预构建 Direct Prompt。                        |
| `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT` | 预构建 Template Prompt，关闭 ScriptReuse 和 StylePreset。 |
| `LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS`  | Template 模式的中间源码契约。                             |

请求间选项不同时优先使用 `buildLynxXmlSystemPrompt`。通过 appendix 追加业务
策略时，应保留转换器要求的产物、生命周期和布局契约。

## Prompt 组合与约束

Prompt 结合固定版本 `@lynx-js/skill-vanilla-lynx` 中选中的指导和 `src/prompt.ts`
中的本地规则。公共指导覆盖 Element PAPI、生命周期、主线程本地事件和样式，
在构建时内联，运行时无需 skill 文件或文件系统读取。

代码示例会被省略，允许和禁止的 CSS 属性等纯文本约束保留且不带 Markdown
代码块。混合运行时章节保留主线程要求，移除后台和跨线程指令；样式参考不受这项
过滤影响，仍包含 CSS background 属性。

本地 Prompt 将公共指导适配到单文件 `.lynxml` 产物，优先级高于导入指导：

- **节点引用**：`__AppendElement` 和追加辅助方法接收节点，不是数字 id。
  `pageId` 用于依赖页面 id 的元素创建 API。Template 初始节点来自 `nodes` 或
  `ctx.nodes`，之后 JavaScript 更新也遵守节点引用规则。
- **布局**：Page 和所有布局 Element 子节点的容器，均通过实际应用的 class
  显式设置 `display: flex` 和 `flex-direction`。ScriptReuse 提供 Page 和
  `genui-page` class，模型使用 `ctx.page`、`ctx.pageId` 并设置业务容器样式。
- **滚动**：默认将确定高度的纵向 `scroll-view` 直接放在 Page 下作为第一个
  业务节点，内容高度不确定时也如此。只有用户明确要求固定单屏布局时才使用不
  滚动的 `view`；恰好能放入一屏不构成例外。业务 `view` 不应包裹 scroll-view。
  固定栏需预留滚动内容空间，包含安全区。Template 用 XML 根节点表达，Direct
  模式使用 Element PAPI 创建并追加。
- **预设样式**：StylePreset 开启时使用 `flex flex-col w-full h-screen`、
  `shrink-0` 等预设类表达布局和滚动，否则由模型编写对应 CSS。
- **数据校验**：未启用 ScriptReuse 时需校验生命周期和应用事件数据。
  ScriptReuse 在调用 hook 前规范化生命周期数据；业务字段和应用事件数据仍需
  业务校验。
- **产物边界**：代码全部放在产物中，不使用 imports、packages、动态代码执行、
  外部脚本、分析或追踪。资源与链接 URL 来自用户、宿主或已启用的搜索/图片工具。
  生成脚本保持本地运行，不发起网络请求。

适配契约独立组合 Template、ScriptReuse、StylePreset，覆盖节点与作用域、显式
布局、滚动与安全区、CSS 值约束。节点映射、初始树转换和生命周期归属详见
[产物与校验](./artifact-guide_zh.md)。全部八种组合在
`test/__snapshots__/prompt/` 下有完整可读的 Prompt 快照。

产品与移动端设计默认值由 GenUI Server 在
`packages/genui/server/design/design-guidance.ts` 中单独组合，本地 Prompt
负责具体的 Lynx 运行时、布局和产物约束。
