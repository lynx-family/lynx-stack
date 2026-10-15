# OpenUI Chat

按需启用这个 Library，可以使用官方 **OpenUI Chat** 的位置参数约定。默认的 `createOpenUiLibrary()` 继续使用现有的 `Stack` 组件库。Chat 的典型签名是 `Card(children, sources?)` 和 `Text(variant, value, subtext?, subtextVariant?, size?)`。

```tsx
import { OpenUiRenderer } from '@lynx-js/genui/openui';
import { createOpenUiChatLibrary } from '@lynx-js/genui/openui/chat';
import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';

const library = createOpenUiChatLibrary();
const response =
  'root = Card([TextContent("**Hello** [1]")], [{title:"Lynx",sourceName:"Documentation",url:"https://lynxjs.org"}])';
// 放在宿主的 luna-light / luna-dark 主题容器中。
<OpenUiRenderer
  library={library}
  response={response}
  onAction={handleAction}
/>;
```

宿主通过 `onAction` 处理 `OpenUrl` 和对话操作；组件不依赖特定的浏览器或后端。Markdown 渲染为原生 Lynx 元素，原始 HTML 则作为文本显示。原生主线程首帧显示纯文本，后台 hydration 再应用 Markdown，避免在主线程虚拟机中执行依赖 Unicode 的解析。引用编号从 1 开始，对应 `Card.sources` 中的条目。

## 按需导入组件

`createOpenUiChatLibrary()` 会注册完整的 Chat 组件库及其组件样式，不会根据响应里出现的组件自动移除样式。要让未使用的组件和样式不进入应用，请使用独立组件入口和不预载组件库的工厂：

```tsx
import {
  createOpenUiLibrary,
  OpenUiRenderer,
} from '@lynx-js/genui/openui/explicit';
import { Card } from '@lynx-js/genui/openui/chat/Card';
import { Text } from '@lynx-js/genui/openui/chat/Text';
import { Button } from '@lynx-js/genui/openui/chat/Button';
import '@lynx-js/luna-styles/index.css';
import '@lynx-js/genui/openui/styles/theme.css';

const library = createOpenUiLibrary({
  root: 'Card',
  includeDefaultComponents: false,
  components: [Card, Text, Button],
});

<OpenUiRenderer
  library={library}
  response={'root = Card([Text("text", "Hello"), Button("Continue")])'}
/>;
```

每个组件会自动导入自己的 CSS，无需单独导入组件样式表。必要的共享样式仍会保留：`BoldText` 使用 `Text` 的样式，`TextContent` 使用 Chat Markdown 的样式。主题 token 仍由宿主导入。`Col` 等仅定义 schema 的条目没有渲染样式。需要排除未使用模块时，请使用组件子路径，而不是聚合的 `openui/chat` 入口。

## 服务端 Prompt 生成与校验

```ts
import { createOpenUiChatPromptLibrary } from '@lynx-js/genui/openui/chat/agent';
const library = createOpenUiChatPromptLibrary();
const prompt = library.prompt();
const schema = library.toJSONSchema();
```

如果客户端只使用部分组件，服务端也应使用对应的 headless 组件子路径，让 Agent 生成相同的组件词汇：

```ts
import { createLibrary } from '@openuidev/lang-core';
import { Card } from '@lynx-js/genui/openui/chat/agent/Card';
import { Text } from '@lynx-js/genui/openui/chat/agent/Text';
import { Button } from '@lynx-js/genui/openui/chat/agent/Button';

const library = createLibrary({
  root: 'Card',
  components: [Card, Text, Button],
});
const prompt = library.prompt();
```

这些入口既不会加载 ReactLynx，也不会加载 CSS。组件和 Agent 子路径覆盖下面列出的全部组件，包括共享的 `Button`。

支持的组件：

- 内容：`Card`、`TextContent`、`Text`、`BoldText`、`Button`、`Buttons`、`ImageText`。
- 集合：`ListBlock`、`ListItem`、`Steps`、`StepsItem`、`SectionBlock`、`SectionItem`、`Table`、`Col`。
- 卡片：`CompositeCardBlock`、`CompositeCardItem`。
- 表单：`Form`、`FormControl`、`Input`、`RadioGroup`、`RadioItem`、`CheckBoxGroup`、`CheckBoxItem`、`Slider`。
- 扩展组件：`ProductFeature(src, alt, title, subtitle, paragraphs, price, url)`。它不是上游 OpenUI Chat 组件。

这里支持的是上游 Chat Library 的明确子集；解析器会报告未知组件。组合卡片的头部支持 ImageText 和 Text，主体支持 Text、BoldText 和 ListBlock，价格使用 BoldText，底部按钮使用 Button。传入靠后的位置参数时，跳过的可选参数必须保留为 `null`。

Section 支持流式展开和 `isFoldable=false`，折叠时内容仍保持挂载。命名组件声明在数组变化时保持身份稳定，也支持重复引用。Table 的列数据既可以包含标量，也可以包含已注册的组件节点；较短的列会保留空单元格。网格和轮播布局使用同一套 CompositeCardItem 约定。卡片块的 action 会携带所选条目的上下文，底部按钮则独立派发自己的 action。

表单使用 `Form(name, buttons, fields)` 和 `FormControl(label, input, hint?)`。`Input`、`RadioGroup`、`CheckBoxGroup` 和 `Slider` 的最后一个参数可以传入响应式绑定；未传入时，通过字段名定位所属表单中的值。插入、删除或重排字段时，请使用稳定且唯一的字段名和命名组件声明。

```text
root = Card([form, progress])
$ready = {passport: false, boots: false}
form = Form("trip", Buttons([Button("Continue")]), [documents, clothing])
documents = FormControl("Documents", CheckBoxGroup("ready", [CheckBoxItem("Passport", "Check expiry", "passport")], {required: true}, $ready))
clothing = FormControl("Clothing", CheckBoxGroup("ready", [CheckBoxItem("Boots", "Pack footwear", "boots")], {required: true}, $ready))
progress = TextContent("Ready: " + ($ready.passport ? 1 : 0) + " / " + ($ready.boots ? 1 : 0))
```

共享绑定的复选框组会把修改合并到完整对象中，校验只检查各组自己的条目。默认值只初始化缺失的值，不会覆盖恢复的状态或用户编辑。流式生成期间禁止编辑和提交。按钮 action 执行前会运行结构化校验规则，action 接收当前表单状态。

Slider 的状态和 `defaultValue` 即使只有一个值也使用数组，与 `@First($budget)` 等 Chat 表达式保持一致。多个值会渲染为独立、有边界且保持顺序的 Lynx 滑块。原生呈现与上游的多滑块轨道不同，但位置参数和状态约定相同。

组件约定固定参考 [thesysdev/openui](https://github.com/thesysdev/openui/tree/86da07f6266887ff819cd5a8e295c75b2edc8251/packages/react-ui/src/genui-lib)。版权与来源说明见 `THIRD_PARTY_NOTICES.md`。
