# Libraries、内置组件与自定义组件

OpenUI **Library** 是 Agent 与 client 之间的 contract。它描述 Agent 可以写出的
component calls，提供解析和 prompt 生成所需的 JSON Schema，并把每个允许的名称
映射到可信的 ReactLynx renderer。

这篇指南介绍默认 Library、其中 26 个内置组件，以及新增或替换组件的流程。

## Library 包含什么

每个 component definition 有四部分：

- 稳定的 OpenUI component `name`；
- 一个 Zod object schema，字段顺序决定位置参数顺序；
- 一段用于 generated prompt 的简短 `description`；
- 可信的 ReactLynx `component` 实现。

`createOpenUiLibrary()` 把这些 definitions 组合成带以下成员的 `Library`：

| 成员              | 用途                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `components`      | Renderer 使用的 name-to-definition map。                                                                                               |
| `componentGroups` | Prompt 和 tooling 使用的分类及排序提示。                                                                                               |
| `root`            | `root` statement 必须使用的组件类型；默认为 `Stack`。                                                                                  |
| `toJSONSchema()`  | 带位置 prop definitions 的 parser/handshake schema。                                                                                   |
| `toSpec()`        | 框架无关的 prompt specification。                                                                                                      |
| `prompt(options)` | 面向这个精确 Library 的底层 prompt 生成。Server 侧应优先使用 [system prompt 指南](./system-prompts_zh.md)介绍的 headless prompt 入口。 |

默认 Library 应只创建一次，并保持对象 identity 稳定：

```tsx
const library = useMemo(() => createOpenUiLibrary(), []);

<OpenUiRenderer response={response} library={library} />;
```

## 内置组件

`createOpenUiLibrary()` 包含以下组件。它们也从
`@lynx-js/genui/openui/catalog` 导出。

### 布局

| 组件     | 用途                                                             |
| -------- | ---------------------------------------------------------------- |
| `Stack`  | 支持换行、间距、对齐和排列的通用横/纵向布局；默认 Library root。 |
| `Row`    | 横向布局容器。                                                   |
| `Column` | 纵向布局容器。                                                   |
| `List`   | 带可选分割线和间距的纵向或横向集合。                             |

### 内容

| 组件          | 用途                                                          |
| ------------- | ------------------------------------------------------------- |
| `Card`        | 带 Stack 类布局 props 的 `card`、`sunk` 或 `clear` 样式容器。 |
| `CardHeader`  | Card 的标题和可选副标题。                                     |
| `Text`        | 带 `h1`、`h2`、`caption`、`body` 等语义 variants 的普通文本。 |
| `TextContent` | 带紧凑字号/字重 variants 的内容文本。                         |
| `Separator`   | 简单视觉分隔符。                                              |
| `Divider`     | 横向或纵向分割线。                                            |

### 按钮

| 组件      | 用途                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `Button`  | 可点击的 primary、secondary 或 tertiary action，支持 destructive 样式。 |
| `Buttons` | `Button` 组件组。                                                       |

### 数据展示与媒体

| 组件          | 用途                                                |
| ------------- | --------------------------------------------------- |
| `Tag`         | 紧凑标签或状态 tag。                                |
| `Image`       | 带 fit 和语义尺寸 variants 的远程图片。             |
| `Icon`        | 内置 Material Icons 字形，支持尺寸和颜色 variants。 |
| `Video`       | 带 URL 和可选标题的视频附件占位。                   |
| `AudioPlayer` | 带 URL 和描述的音频附件占位。                       |
| `Loading`     | Inline 或 block skeleton/loading feedback。         |

### 浮层

| 组件    | 用途                                           |
| ------- | ---------------------------------------------- |
| `Tabs`  | 在带 label 的多个 child view 间切换。          |
| `Modal` | 从 trigger 组件打开 generated detail content。 |

### 输入

| 组件            | 用途                                                   |
| --------------- | ------------------------------------------------------ |
| `CheckBox`      | 带可选 action 和 form name 的布尔输入。                |
| `RadioGroup`    | 带 default、card 或 row 展示方式的单选输入。           |
| `ChoicePicker`  | 以 chips、list 或 dropdown-like control 展示的选择器。 |
| `Slider`        | 带可选 step 和 action 的数值范围输入。                 |
| `TextField`     | 支持可选 regex 校验的短文本、数字、密码或多行输入。    |
| `DateTimeInput` | 带 label、上下界和日期/时间展示开关的值。              |

`RadioGroup`、`Slider` 和 `TextField` 使用 `@lynx-js/lynx-ui`；generated UI
允许使用这些组件时，需要添加该 peer dependency。

完整、最新的位置参数签名和 live preview 见
[OpenUI Catalog](https://lynx-stack.dev/genui/#/openui/catalog)。Schema 是唯一事实来源：
可选参数只能从右侧开始省略，也不支持 named-argument syntax。

## OpenUI component 语法

组件 Zod object 中的字段顺序，就是 wire-level 位置参数顺序。例如内置 Stack
schema 依次以 `children`、`direction`、`wrap`、`gap`、`align` 和 `justify`
开头，因此下面的写法合法：

```text
root = Stack([header, body], "column", false, "m", "stretch", "start")
```

下面不是合法的 OpenUI Lang：

```text
root = Stack(children: [header, body], gap: "m")
```

Child components 也是 values。它们既可以声明为具名 statements，也可以在 parent
schema 允许时 inline 使用：

```text
root = Card([title, TextContent("Inline content")])
title = CardHeader("Account", "Updated just now")
```

## 添加自定义组件

如果应用还没有直接依赖 Zod，先安装：

```sh
pnpm add zod
```

用稳定名称、有序 prop schema、prompt description 和 ReactLynx renderer 定义
组件。样式应放进 CSS class，而不是 inline style object；可见文本必须包在
`<text>` 中。

```tsx
import { createOpenUiLibrary, defineComponent } from '@lynx-js/genui/openui';
import { z } from 'zod/v4';

import './Banner.css';

export const Banner = defineComponent({
  name: 'Banner',
  description: 'Compact status banner with a title and tone.',
  props: z.object({
    title: z.string(),
    tone: z.enum(['info', 'success', 'warning']).optional(),
  }),
  component: ({ props }) => (
    <view className={`Banner Banner-${props.tone ?? 'info'}`}>
      <text className='BannerTitle'>{props.title}</text>
    </view>
  ),
});

export const library = createOpenUiLibrary({
  components: [Banner],
  componentGroups: [
    { name: 'Product', components: ['Banner'] },
  ],
});
```

Agent 现在可以输出：

```text
root = Stack([notice])
notice = Banner("Payment received", "success")
```

调用方提供的 components 和 groups 会追加在默认值后。如果自定义组件与内置组件
同名，后加入的自定义 definition 会覆盖 `components` map 中的默认值。这应当被
视为一次有意 override，并且 prompt 侧 schema 必须与它保持一致。

## 渲染嵌套 component values

如果自定义 prop 接受 child components，请使用 component render contract 中的
`renderNode`。它会通过 active Library 递归渲染 elements、arrays 和 primitive
values。

```tsx
export const Panel = defineComponent({
  name: 'Panel',
  description: 'A titled container for generated child content.',
  props: z.object({
    title: z.string(),
    children: z.array(z.any()),
  }),
  component: ({ props, renderNode }) => (
    <view className='Panel'>
      <text className='PanelTitle'>{props.title}</text>
      <view className='PanelBody'>{renderNode(props.children)}</view>
    </view>
  ),
});
```

不要在自定义组件里调用 generated functions，也不要执行 generated strings。让
OpenUI parser/runtime 在 props 到达 renderer 前完成表达式求值。

## 交互组件使用的 runtime hooks

自定义组件可以使用 `@lynx-js/genui/openui` 导出的 hooks：

| Hook                                                | 用途                                                |
| --------------------------------------------------- | --------------------------------------------------- |
| `useRenderNode()`                                   | 渲染嵌套 generated values。                         |
| `useTriggerAction()`                                | 执行 `ActionPlan` 或发出宿主 action。               |
| `useIsStreaming()`                                  | Generated text 不完整时禁用交互。                   |
| `useIsQueryLoading()`                               | 读取是否有 Query 正在执行。                         |
| `useGetFieldValue()`                                | 从 runtime Store 读取 `$variables` 或 form values。 |
| `useSetFieldValue()`                                | 更新 form state，并按需触发持久化。                 |
| `useSetDefaultValue()`                              | Streaming 结束后初始化字段，同时避免覆盖用户输入。  |
| `useOpenUI()`                                       | 高级接入时访问完整 runtime context。                |
| `useFormValidation()` / `useCreateFormValidation()` | 读取或创建自定义 form validation boundary。         |

这些 hooks 都必须运行在 `<OpenUiRenderer>` 下方。交互组件应遵守
`isStreaming`，防止用户操作尚未完成的模型 response。

## JSON Schema 与 parser utilities

在 renderer 外解析或检查 OpenUI 时，可以使用 Library schema：

```ts
import { createOpenUiLibrary, createParser } from '@lynx-js/genui/openui';

const library = createOpenUiLibrary();
const parser = createParser(library.toJSONSchema(), library.root);
const result = parser.parse('root = Stack([TextContent("Hello")])');
```

流式文本使用 `createStreamingParser`。如果 UI 保存累计 response，可以调用
`set(fullText)`；如果只传新增 delta，则调用 `push(chunk)`。

如果同一 response 已经交给 renderer，优先使用它的 `onParseResult` callback，避免
为了检查 `root`、`stateDeclarations`、data statements 或 `meta` diagnostics 而
创建第二个 parser。

## 保持 Agent contract 一致

只把组件加入 ReactLynx Library 还不够：Agent 必须收到相同的名称、位置 schema
和描述。默认 prompt 入口刻意保持 headless，使 server code 不需要导入 ReactLynx
或组件 CSS。使用自定义组件时，需要定义匹配的 headless prompt entries，并传给
`buildOpenUiSystemPrompt`。

完整 CLI 与程序化流程见 [System Prompts](./system-prompts_zh.md)。
