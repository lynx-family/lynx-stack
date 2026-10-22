# 产物与校验

通过公开入口 `@lynx-js/genui/lynx-xml` 处理模型输出，再交给 Lynx XML 渲染器。
Prompt 选项与转换选项必须保持一致。

## 提取、规范化并校验产物

```ts
import { normalizeLynxXmlArtifact } from '@lynx-js/genui/lynx-xml';

// 返回提取并规范化后的产物；产物结构不合法时抛出异常。
const source = normalizeLynxXmlArtifact(modelOutput);
```

`normalizeLynxXmlArtifact` 会从说明文字或 Markdown 代码块中提取产物；存在 `<lynx>` 根节点但缺少
`<!doctype lynx>` 时，会补齐 doctype。找不到产物或产物结构契约不合法时抛出异常。
它要求根节点采用 `<lynx engine-version="...">`，包含闭合的 `</lynx>`、恰好一个
已闭合的 `<script thread="main">`，且没有 CDATA。Template 或 ScriptReuse 的
中间产物应先转换，再规范化并校验最终产物。

`assembleLynxXmlArtifact` 内部会提取中间产物，业务可以直接传入原始模型响应。
提取函数是内部工具，不从包入口导出。

这些检查延续了 GenUI Agent 的产物契约，不解析 JavaScript 或 CSS，不校验
Element PAPI 语义，也不保证渲染效果。转换会对启用的能力进行额外静态检查，
执行与渲染由 Lynx 运行时负责。

## 转换模型输出

所有选项组合均可使用统一入口：

```ts
import {
  assembleLynxXmlArtifact,
  normalizeLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const options = {
  enableHtmlFragment: true,
  enableScriptReuse: true,
  stylePreset: 'default',
} as const;

const { text, xmlFragment } = assembleLynxXmlArtifact(modelOutput, options);
const artifact = normalizeLynxXmlArtifact(text);
```

把完整原始模型响应交给 `assembleLynxXmlArtifact`。它会提取源码，并按选项应用
Template、ScriptReuse 和 StylePreset 转换。`text` 是转换后的产物；启用
Template 时还返回 `xmlFragment`。原始响应应单独保留，用于对话历史和问题排查。

规范化不会执行这些转换，交付前应规范化并校验转换后的产物。Direct 模式关闭全部选项时，
可以直接从模型输出中提取、规范化并校验产物。

## 转换模板产物

使用 `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT`，或通过
`enableHtmlFragment: true` 构建自定义 Prompt：

```ts
import {
  assembleLynxXmlArtifact,
  LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT,
} from '@lynx-js/genui/lynx-xml';

const prompt = LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT;

function transformModelOutput(source: string) {
  const { text, xmlFragment } = assembleLynxXmlArtifact(source, {
    enableHtmlFragment: true,
  });
  return { text, xmlFragment };
}
```

这里的 `source` 是模型返回的完整中间产物，必须满足以下规则：

- `<lynx>` 下恰好包含一个直接子节点 `<template>`，与普通 style 和 script 块
  同级。块顺序不限，主线程脚本必须恰好一个。
- 只给事件、更新或清理需要引用的节点设置唯一 id。纯静态节点无需 id。
- 渲染时恰好调用一次 `createFragment(page, pageId)`，将返回的 id 到节点映射
  保存在脚本作用域的 `nodes` 中，之后通过 `nodes["root"]` 等方式访问。该辅助
  函数由转换器提供，模型不得声明或遮蔽它。

转换会移除 template，并注入创建、追加初始元素树的 `createFragment`，返回的
映射仅包含显式 id 节点。结果的 `text` 是用于渲染的完整 `.lynxml` 产物，
`xmlFragment` 是模板中的原始 XML。

转换不执行 JavaScript，会保留源码顺序和非空文本内部的空白，拒绝重复 id，
限制片段长度与嵌套深度。渲染仍由业务负责。

### 可选 StylePreset 转换

Prompt 构建和转换使用相同的 `stylePreset`：

```ts
import {
  buildLynxXmlSystemPrompt,
  assembleLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const stylePreset = 'default';
const prompt = buildLynxXmlSystemPrompt({
  enableHtmlFragment: true,
  stylePreset,
});

// 模型可使用 class="flex flex-col gap-4 p-6 bg-slate-50"。
const { text } = assembleLynxXmlArtifact(modelOutput, {
  enableHtmlFragment: true,
  stylePreset,
});
```

省略 `stylePreset` 或设为 `false` 会关闭预设样式。StylePreset 独立于 Template，
Direct 产物也可以使用：

```ts
import { applyLynxXmlStylePreset } from '@lynx-js/genui/lynx-xml';

const text = applyLynxXmlStylePreset(source, 'default');
```

这里的 `source` 是已提取的完整 Direct 产物。需要直接处理原始模型响应时，优先
使用 `assembleLynxXmlArtifact(modelOutput, { stylePreset: 'default' })`。

`'default'` 启用有限的 Lynx 工具类集合。转换器从模板和主线程脚本中的完整字符串
字面量收集类名，只注入匹配规则，并放在业务样式之前，合并为一个 `<style>` 块。
多个业务 style 块按源码顺序合并。预设规则顺序稳定，不依赖 class 顺序；相同
优先级的业务 CSS 可覆盖预设。未知类名可用于自定义样式，应避免同一属性的工具类
互相冲突。

预设包含 Flex 布局、间距与尺寸（4px 步进）、字体、颜色、圆角、边框、透明度和
overflow。例如 `p-4` 表示 `padding: 16px`，`text-lg` 仅设置
`font-size: 18px`，`border` 设置实线 1px 边框。值采用字面量 px 或十六进制颜色。
不提供自动 reset、CSS 变量、任意值、分数尺寸、`hover:` 或 `sm:` 变体、`@apply`。
这些需求应使用自定义 CSS。启用后的 System Prompt 包含完整支持列表。

动态状态类必须以完整字面量出现，例如
`active ? 'bg-blue-500' : 'bg-gray-100'`；拼接 `'bg-' + color + '-500'` 不会注册
对应类。转换阶段不执行 JavaScript。最终产物自包含，无需下载样式或构建配置。
类名可减少模型输出 token，但预设词表增加输入 token，转换产物仍包含解析后的
CSS。延迟和 token 收益应通过实际任务测量。

GenUI Create 的 Design、Template、StylePreset 独立，新增记录默认开启。设置随
记录保存，并在选择或重新加载时恢复。对话已有生成历史后，这些选项变为只读，
需要新建对话才能调整。新建 Lynx XML Bench 分组也默认开启并保存这些选项，历史
设置保持原值。Template 对应 `enableHtmlFragment`，Server 请求通过
`enableHtmlFragment: true` 和 `stylePreset: 'default'` 独立启用；API 默认关闭。
最终元数据记录选中的预设。

### 可选 ScriptReuse 转换

在 `buildLynxXmlSystemPrompt` 和 `assembleLynxXmlArtifact` 中同时设置
`enableScriptReuse: true`。API 默认值是 `false`，独立于 Template 和 StylePreset。
转换器在本地提供页面创建、生命周期注册、渲染保护、事件清理和 UI 辅助方法，
模型只编写业务状态和同步回调。

```xml
<!doctype lynx>
<lynx engine-version="4.2">
<template><text id="count">0</text></template>
<script thread="main">
let count = 0;
definePage({
  render(ctx) {
    ctx.on(ctx.nodes.count, "tap", () => ctx.setText(ctx.nodes.count, ++count));
  },
  update(ctx, patch) {
    if (typeof patch.count === "number") count = patch.count;
    ctx.setText(ctx.nodes.count, count);
  }
});
</script>
</lynx>
```

这是中间契约，不能直接交给运行时。预览或交付前使用相同选项调用
`assembleLynxXmlArtifact`，再规范化并校验转换后的产物。

`definePage` 必须恰好一次出现在顶层，参数对象可包含同步的 `render(ctx, data)`、
`update(ctx, patch)`、`destroy(ctx)`。未启用 Template 时必须提供 `render`，
通过 Element PAPI 创建业务树。`ctx.page`、`ctx.pageId` 和 `ctx.nodes` 在 render
前已经存在；启用 Template 时，初始树和节点映射也已创建。

Template 与 ScriptReuse 同时启用时，模型使用以下 UI 辅助方法：

- 创建：`ctx.createView()`、`ctx.createScrollView()`、`ctx.createText(value)`、
  `ctx.createImage()`。
- 元素树：`ctx.append(parent, child)`、`ctx.replaceChildren(parent, children)`。
- 更新：`ctx.setText(textNode, value)`、`ctx.setClasses(node, classes)`、
  `ctx.setAttribute(node, name, value)`、`ctx.setInlineStyles(node, styles)`。

公共脚本把这些调用转换为 Element PAPI。原始 Element PAPI 仍可兼容，但不属于
此模式面向模型的契约。`ctx.on(node, name, handler, options?)` 和
`ctx.listen(name, handler)` 返回取消订阅函数；`ctx.emit(name, data)` 使用共享
主线程本地事件上下文。

`ctx.replaceChildren` 自动清理移除子树中的监听器，保留复用节点的监听器，剩余
监听器在 destroy 时清理。`ctx.setText` 替换文本子节点。首次渲染使用 SDK flush，
update 和已注册事件回调自动 flush，其他同步回调中的修改才需调用 `ctx.flush()`。
生命周期 hook 接收引擎 `event.data` 中第一个对象，默认 `{}`；业务状态合并仍由
模型负责，destroy 释放页面资源。

Create 和新建 Bench 分组默认开启 ScriptReuse。显式保存值会保留；Create 缺失
设置时默认开启，历史 Bench 计划和报告缺少该选项时保持关闭。HTTP 接入使用
`POST /lynx-xml/stream` 和 `"enableScriptReuse": true`。最终元数据保留
`modelOutput` 并记录开关。流式输出仍展示原始增量，预览和 Judge 接收转换后的
独立产物；不合法契约仍保留用量信息并使用已有修复策略，转换不执行模型代码或
增加模型调用。

Create 启用 ScriptReuse 后，后续请求发送保存的原始 assistant 输出，避免重复
发送注入的辅助逻辑；旧记录没有原始输出时回退到保存的产物。

Template 和 ScriptReuse 同时启用时，Prompt 使用更紧凑的 Vanilla Lynx 指导，
以 `definePage`/`ctx` 契约替代初始树创建、生命周期注册和底层监听器指导，保留
完整样式约束。StylePreset 开启或关闭均适用，无需新增开关。最终产物仍内联公共
实现，其体积不会按同等幅度减少。评估收益时固定 Bench 条件，只改变 ScriptReuse，
比较输入/输出 token、生成时长、合法率和 Judge 结果；源码字符数不能替代模型
服务返回的 token 用量和实际延迟。

### 转换独立片段

自定义转换流程可将 XML 片段转换为主线程 JavaScript：

```ts
import { generateMainThreadScriptResult } from '@lynx-js/genui/lynx-xml';

const { bindings, javascript } = generateMainThreadScriptResult(
  '<view id="root"><text>Hello</text></view>',
);
```

生成的 `javascript` 假定作用域中有 `page` 和 `pageId`，并创建 `nodeMap`。
`bindings` 将显式 XML id 映射到 JavaScript 表达式字符串，例如
`{ root: 'nodeMap["root"]' }`，不是运行时节点。结果还包含模板类名去重后的
`classNames`。只需要 JavaScript 字符串时使用 `generateMainThreadScript`。

## 流式输出与失败处理

这些 API 同步接收字符串并返回结果，不调用模型或管理流。积累模型增量，响应
完成后再转换并渲染；未完成输出可能缺少闭合标签或注册代码，不能视为最终产物。

在业务接入边界捕获转换和规范化错误。修复流程可将错误与原始请求交给模型，
限制重试次数。失败时保留原始输出和用量信息。规范化成功只说明产物结构契约通过，
执行和渲染需要 Lynx 运行时预览验证。

继续阅读 [System Prompts](./system-prompts_zh.md)，或返回[简介](../README_zh.md)。
