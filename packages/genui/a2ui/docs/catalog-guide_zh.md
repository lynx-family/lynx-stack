# Catalogs、内置组件与自定义组件

**catalog** 是你的 Agent 和 client 之间的 contract：它列出 renderer 被允许
实例化的 component、可以执行的 function，并携带 Agent 在 handshake 时读取的
可选 JSON schema。这篇指南覆盖关于组合这份 contract 的一切——从一行的最小写法，
到内置组件集合，再到发布你自己的组件并生成它们的 schema。

如果你只想快速浏览一节，请看[内置组件](#内置组件)和[basic-catalog functions](#basic-catalog-functions)：那是你的 Agent 能使用的「词汇表」。

## catalog 是什么

一个 catalog 有两类 entry：

- **Component**——把一个协议名（`"Text"`、`"Card"`、你的 `"MyChart"`）映射到
  client 渲染的 ReactLynx 组件。
- **Function**——把一个协议 function 名（`"formatDate"`、`"required"`）映射到
  客户端实现，renderer 在解析 props、actions 和 validation checks 时调用它。

你用 `defineCatalog` 构建它，然后要么把它（或一个原始 input 数组）传给
`<A2UI catalogs={…}>` 用于渲染，要么用 `serializeCatalog` 把这份 contract
告知你的 Agent。

一个组件的**协议名**来自 `displayName ?? component.name`，除非你把它和 manifest
配对——这时 manifest 的顶层 key 是权威的。Agent 只引用这个名字，所以保持它稳定
很重要（见下面的 minifier 警告）。

## 从小开始：renderer-only components

如果你的应用只需要渲染，直接传 bare components 即可。不需要 schema，也没有任何
仪式感。

```ts
import { defineCatalog, Text, Button } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([Text, Button]);
```

你也可以把同一个数组直接传给 `<A2UI>` 而不必自己调用 `defineCatalog`——组件会在
内部组合它：

```tsx
<A2UI messageStore={store} catalogs={[Text, Button]} onAction={…} />;
```

打包器会 tree-shake 掉未使用的组件：引入 `Text` **不会**把 `Button`、`Card` 或
其他任何内置组件拖进你的 bundle。

> ⚠️ **生产环境 minifier 会改写 function 声明名**，这会破坏 `component.name`
> 这个回退。为了生产安全，请给每个自定义组件设置显式 `displayName`（字符串
> 字面量能在 minify 后保留），或用 tuple 形式把组件和它的 `catalog.json`
> manifest 配对——manifest 的 key 是权威的，也不受 minify 影响。

## 内置组件

这个包提供 20 个 A2UI v0.9 basic-catalog renderer。每个都是独立、可 tree-shake
的导出，既可从根导入，也可从 `@lynx-js/genui/a2ui/catalog/<Name>` 导入。

**布局与容器**

| 组件      | 渲染什么                                               |
| --------- | ------------------------------------------------------ |
| `Row`     | 一个用于 `children` 列表的水平布局容器。               |
| `Column`  | 一个用于 `children` 列表的垂直布局容器。               |
| `Card`    | 一个带 padding、有层次感的 surface，包裹单个 `child`。 |
| `List`    | 一个可滚动的集合——通常是 templated children 的目标。   |
| `Tabs`    | 在多个子视图之间切换的标签分区。                       |
| `Modal`   | 一个层叠在其余 UI 之上的 overlay/dialog surface。      |
| `Divider` | item 之间的一条细分隔线。                              |

**内容**

| 组件    | 渲染什么                                      |
| ------- | --------------------------------------------- |
| `Text`  | 一段文本，带 `variant`（如 `body`）控制样式。 |
| `Image` | 来自 source URL 的图片。                      |
| `Icon`  | 一个具名 icon 字形。                          |

**输入与动作**

| 组件            | 渲染什么                                     |
| --------------- | -------------------------------------------- |
| `Button`        | 一个可点击、会 dispatch 用户 action 的按钮。 |
| `TextField`     | 一个绑定到 data model 的单行文本输入。       |
| `CheckBox`      | 一个布尔开关。                               |
| `RadioGroup`    | 一组单选的 radio 选项。                      |
| `ChoicePicker`  | 一个在多个选项中选择的 picker/select。       |
| `Slider`        | 在一个范围上选择的数值。                     |
| `DateTimeInput` | 一个日期和/或时间输入。                      |

**数据可视化**

| 组件        | 渲染什么                   |
| ----------- | -------------------------- |
| `LineChart` | 基于一系列数据点的折线图。 |
| `PieChart`  | 基于一组数值的饼图。       |

**反馈**

| 组件      | 渲染什么                                                                          |
| --------- | --------------------------------------------------------------------------------- |
| `Loading` | 一个加载指示器。也是 `<A2UI>` 在 surface 处于 pending 时的默认 `renderFallback`。 |

要了解每个组件接受的确切 props，请阅读它的 manifest
`@lynx-js/genui/a2ui/catalog/<Name>/catalog.json`——那份 JSON 就是 Agent 看到的
同一份 schema。

## 为 Agent handshake 加入 manifests

如果你希望 `serializeCatalog(...)` 为每个组件输出 JSON Schema（让 Agent 知道该
发哪些 props），用 tuple 形式把每个组件和 `dist/catalog/<Name>/catalog.json`
生成的 JSON 配对：

```ts
import { Text, defineCatalog, serializeCatalog } from '@lynx-js/genui/a2ui';
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

协议名作为顶层 key 存在 JSON 里，所以运行时从不重复它。没有 manifest 就注册的
组件照样能渲染——它们只是序列化成 `{ name }`，告诉 Agent 该组件存在，但不描述
它的 props。

## basic-catalog functions

A2UI messages 可以在 dynamic props、action payload 和 validation checks 里内嵌
function call——例如 `{ call: 'formatDate', args: { … } }`。这些在**客户端的渲染
时刻**运行。要让它们可用，把 `...basicFunctions` 展开进同一个 catalog input 列表：

```ts
import { Text, basicFunctions, defineCatalog } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([Text, ...basicFunctions]);
```

`basicFunctions` 是一组现成 entry 的数组，它们的实现直接来自上游
`@a2ui/web_core` basic catalog，所以 wire contract 能免费地与 A2UI v0.9 spec
保持一致。它覆盖 25 个 function：

| 类别   | Functions（协议名）                                                         |
| ------ | --------------------------------------------------------------------------- |
| 算术   | `add`、`subtract`、`multiply`、`divide`                                     |
| 比较   | `equals`、`not_equals`、`greater_than`、`less_than`                         |
| 逻辑   | `and`、`or`、`not`                                                          |
| 文本   | `contains`、`starts_with`、`ends_with`、`length`                            |
| 校验   | `required`、`regex`、`numeric`、`email`                                     |
| 格式化 | `formatString`、`formatNumber`、`formatCurrency`、`formatDate`、`pluralize` |
| 动作   | `openUrl`                                                                   |

> 注意大小写不统一——比较/文本类用 `snake_case`（`not_equals`、`starts_with`），
> 而格式化类用 `camelCase`（`formatDate`、`openUrl`）。这些是上游 A2UI v0.9 的
> 名称；在 message 里请原样使用。

只要你的 Agent 可能发出其中任何一个，就加入 `...basicFunctions`。如果某条
message 引用了 catalog 里没有的 function，那次调用会解析为 `undefined` 而不是
抛错。

如果你构建自己的 renderer 而不用 `<A2UI>`，调用一次 `registerBasicFunctions()`
就能把这些相同的实现注册进共享的 `functionRegistry`。

## 为什么没有 `catalog/all`

这个包刻意**不**提供 all-in-one 的 catalog 常量，也没有
`@lynx-js/genui/a2ui/catalog/all` 导出。一个引用所有内置组件的顶层数组会破坏
tree-shaking——任何用到这个聚合的消费者都会打包全部组件，即使它们从不渲染其中
某些。组合是逐组件的，bundle 成本在 import 处保持可见。

## 可粘贴的「全部内置」配方

当你确实想要它们全部时，请把列表保留在接入点。下面这段组合了每个内置组件及其
manifest，外加 basic functions：

```tsx
import {
  basicFunctions,
  defineCatalog,
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
  Loading,
  Modal,
  PieChart,
  RadioGroup,
  Row,
  Slider,
  Tabs,
  Text,
  TextField,
} from '@lynx-js/genui/a2ui';
import buttonManifest from '@lynx-js/genui/a2ui/catalog/Button/catalog.json' with {
  type: 'json',
};
import cardManifest from '@lynx-js/genui/a2ui/catalog/Card/catalog.json' with {
  type: 'json',
};
import checkBoxManifest from '@lynx-js/genui/a2ui/catalog/CheckBox/catalog.json' with {
  type: 'json',
};
import choicePickerManifest from '@lynx-js/genui/a2ui/catalog/ChoicePicker/catalog.json' with {
  type: 'json',
};
import columnManifest from '@lynx-js/genui/a2ui/catalog/Column/catalog.json' with {
  type: 'json',
};
import dateTimeInputManifest from '@lynx-js/genui/a2ui/catalog/DateTimeInput/catalog.json' with {
  type: 'json',
};
import dividerManifest from '@lynx-js/genui/a2ui/catalog/Divider/catalog.json' with {
  type: 'json',
};
import iconManifest from '@lynx-js/genui/a2ui/catalog/Icon/catalog.json' with {
  type: 'json',
};
import imageManifest from '@lynx-js/genui/a2ui/catalog/Image/catalog.json' with {
  type: 'json',
};
import lineChartManifest from '@lynx-js/genui/a2ui/catalog/LineChart/catalog.json' with {
  type: 'json',
};
import listManifest from '@lynx-js/genui/a2ui/catalog/List/catalog.json' with {
  type: 'json',
};
import loadingManifest from '@lynx-js/genui/a2ui/catalog/Loading/catalog.json' with {
  type: 'json',
};
import modalManifest from '@lynx-js/genui/a2ui/catalog/Modal/catalog.json' with {
  type: 'json',
};
import pieChartManifest from '@lynx-js/genui/a2ui/catalog/PieChart/catalog.json' with {
  type: 'json',
};
import radioGroupManifest from '@lynx-js/genui/a2ui/catalog/RadioGroup/catalog.json' with {
  type: 'json',
};
import rowManifest from '@lynx-js/genui/a2ui/catalog/Row/catalog.json' with {
  type: 'json',
};
import sliderManifest from '@lynx-js/genui/a2ui/catalog/Slider/catalog.json' with {
  type: 'json',
};
import tabsManifest from '@lynx-js/genui/a2ui/catalog/Tabs/catalog.json' with {
  type: 'json',
};
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json' with {
  type: 'json',
};
import textFieldManifest from '@lynx-js/genui/a2ui/catalog/TextField/catalog.json' with {
  type: 'json',
};

export const allBuiltins = defineCatalog([
  [Text, textManifest],
  [Image, imageManifest],
  [Row, rowManifest],
  [Column, columnManifest],
  [List, listManifest],
  [Card, cardManifest],
  [Modal, modalManifest],
  [Button, buttonManifest],
  [Divider, dividerManifest],
  [LineChart, lineChartManifest],
  [PieChart, pieChartManifest],
  [TextField, textFieldManifest],
  [CheckBox, checkBoxManifest],
  [ChoicePicker, choicePickerManifest],
  [DateTimeInput, dateTimeInputManifest],
  [Icon, iconManifest],
  [RadioGroup, radioGroupManifest],
  [Slider, sliderManifest],
  [Tabs, tabsManifest],
  [Loading, loadingManifest],
  ...basicFunctions,
]);
```

对任何你不需要把 schema 发给 Agent 的组件，去掉它的 manifest 导入和 tuple
形式即可——`defineCatalog([Text, Button])` 完全有效。如果你的 messages 用到
function call，就保留 `...basicFunctions`。

## 自定义组件

catalog 组件可以是_任何_接收单个 props 对象并返回 `ReactNode` 的东西。它的
function 名——或它的 `displayName`——就是 Agent 会使用的协议名：

```tsx
function MyChart(props: { data: number[] }) { /* … */ }
// 生产安全所必需：minifier 会改写 `function` 名，但 `displayName` 字符串
// 字面量会保留。
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} … />;
// Agent emits `{ component: 'MyChart', data: [...] }` → renders MyChart.
```

自定义组件从 protocol stream 收到运行时形状的 props。对于任何超出叶子组件的
情况，请使用 `@lynx-js/genui/a2ui/react`——这是自定义组件接入的 contract：

- **`useDataBinding`**——把一个 bound 值（`{ path }`）针对 surface 的 data model
  求值，并拿回一个 setter，这样输入组件就能把用户编辑写回 model。
- **`useResolvedProps`**——一次性解析整个 prop 包，把 data binding 和 function
  call 展开成具体值。
- **`useAction`**——把一个协议 action 变成你在点击/提交时触发的 `sendAction`
  回调；结果会通过 `<A2UI onAction>` 回流出去。
- **`useChecks`**——求值 validation checks（由 `required`/`email` 等 basic
  function 构建），并以 pass/fail 加消息的形式报告。
- **`NodeRenderer`**——针对同一个 surface 渲染 child component id，方式和内置
  组件渲染自己的 children 完全一样。

## 为自定义组件生成 manifest

如果 Agent 需要知道某个自定义组件的 props，生成一个 manifest，并像内置组件那样
把它配对。

1. 把 props 描述为一个 TypeScript `interface`，并用 `@a2uiCatalog <ComponentName>`
   JSDoc 标签标注它，让 extractor 能识别它。
2. 运行公开 CLI 输出 JSON：

   ```bash
   npx @lynx-js/genui a2ui generate catalog --catalog-dir src/catalog --out-dir dist
   ```

3. 把生成的 JSON 与组件配对：

   ```tsx
   import myChartManifest from './dist/catalog/MyChart/catalog.json'
     with { type: 'json' };

   const catalog = defineCatalog([[MyChart, myChartManifest]]);
   ```

`npx @lynx-js/genui a2ui generate catalog` 是面向用户的命令；
`@lynx-js/genui/a2ui-catalog-extractor` 是它背后由 TypeDoc 驱动的引擎。两条约束
能让抽取顺利进行：组件文件夹名必须与导出的 function 名一致
（`src/catalog/MyChart/index.tsx` 导出 `function MyChart`），并且框架级 props
会被排除在产出的 schema 之外。详情见
[extractor README](../../a2ui-catalog-extractor/readme.zh_cn.md)。

## Catalog API 参考

下面这些都从 `@lynx-js/genui/a2ui`（以及 `/catalog` subpath）导出。

- **`defineCatalog(inputs)`**——构建运行时 catalog。`inputs` 是一个数组，可以
  混合 bare components、`[component, manifest]` tuple、已解析的 entry（例如来自
  `mergeCatalogs`），以及 function entries。同一类里的重名会被拒绝。function
  entry 会立即把它的 impl 注册进 `functionRegistry`，所以 `defineCatalog` 之后
  的任何 `executeFunctionCall` 都能路由到它们。
- **`mergeCatalogs(...catalogs)`**——合并多个 catalog，重名时**后写覆盖前写**。
  适合分层：page catalog 覆盖 brand catalog，brand catalog 覆盖内置。
- **`serializeCatalog(catalog)`**——为 Agent handshake 输出 JSON manifest。没有
  附带 schema 的组件序列化成 `{ name }`；function 在有 schema 时带上其参数
  schema 一起序列化。
- **`resolveCatalog(catalog)`**——返回一个 `name → component` 的 map。renderer
  内部用它来解析 `{ component: 'Text' }`；供高级场景暴露。
- **`defineFunction(impl, manifest?)`**——把一个 function 实现包装成 catalog
  entry。带 manifest 时，名字来自 manifest 的 key，schema 会被告知 Agent；不带
  时，名字来自 `impl.displayName ?? impl.name`，Agent 就看不到参数 schema。

## 下一步

- [概览与架构](./overview_zh.md)——一条 message 如何变成 UI、职责划分，以及
  export 映射。
- [System Prompts](./system-prompts_zh.md)——生成让 Agent 与你的 catalog 配套的模型指令。
- [打开 A2UI playground](https://lynxjs.org/a2ui)——在线体验。
