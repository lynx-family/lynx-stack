# Catalog 组合

这个包故意不提供 “all-in-one” catalog 常量。一个引用所有内置组件的顶层数组
会破坏 tree-shaking：只要消费者引用这个聚合，就会把全部组件打进 bundle，即使
实际只用其中几个。Catalog 应该按组件组合，成本应当在 import 处可见。

## Renderer 最少需要什么

如果你的应用只负责渲染，组件名称就足够了。直接传 bare components；协议名来自
`displayName ?? component.name`。

> 生产环境 minifier 会重写 function declaration 名称，这会破坏
> `component.name` fallback。为了生产安全，请给每个自定义组件设置显式
> `displayName`（字符串字面量能在 minification 后保留下来），或者用下面的
> tuple 形式把组件和 `catalog.json` manifest 配对；manifest key 是权威名称。

```tsx
import { A2UI, Button, Text, createMessageStore } from '@lynx-js/genui/a2ui';

const store = createMessageStore();

// 从你的 IO 模块（fetch、SSE 等）写入原始 protocol messages。
// async function streamFromAgent(input) {
//   for await (const msg of myAgent.stream(input)) store.push(msg);
// }

<A2UI
  messageStore={store}
  catalogs={[Text, Button]}
  onAction={(action) => {
    /* 转发给你的 Agent，并把 response messages 写回 store */
  }}
/>;
```

Bundler 可以 tree-shake 未使用组件；导入 `Text` 不会自动带上 `Button`、`Card`
等组件。

## 为 Agent handshake 加入 schemas

如果你希望 `serializeCatalog(...)` 为每个组件输出 JSON Schema，让 Agent 知道
可以发送哪些 props，请把组件和 extractor 在 `dist/catalog/<Name>/catalog.json`
产出的 JSON 配对：

```tsx
import { Text } from '@lynx-js/genui/a2ui/catalog/Text';
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

协议名存在于 JSON 的顶层 key 中，runtime 不需要再复制一份名称。

## “我就是想用所有内置组件” - 可复制配方

这个配方包含所有内置组件和 A2UI v0.9 basic-catalog function entries。包本身
故意不导出 `catalog/all`；请把列表保留在接入点，让 bundle 成本保持可见。

```tsx
import {
  basicFunctions,
  defineCatalog,
  Button,
  Card,
  CheckBox,
  ChoicePicker,
  DateTimeInput,
  Column,
  Divider,
  Icon,
  Image,
  LineChart,
  PieChart,
  List,
  Modal,
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
import dateTimeInputManifest from '@lynx-js/genui/a2ui/catalog/DateTimeInput/catalog.json' with {
  type: 'json',
};
import columnManifest from '@lynx-js/genui/a2ui/catalog/Column/catalog.json' with {
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
import pieChartManifest from '@lynx-js/genui/a2ui/catalog/PieChart/catalog.json' with {
  type: 'json',
};
import listManifest from '@lynx-js/genui/a2ui/catalog/List/catalog.json' with {
  type: 'json',
};
import modalManifest from '@lynx-js/genui/a2ui/catalog/Modal/catalog.json' with {
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
  ...basicFunctions,
]);
```

如果某个组件的 schema 不需要发给 Agent，可以去掉对应的 `manifest` import 和
tuple 形式。只要你的 A2UI messages 在 dynamic props、actions 或 validation
checks 中使用 function calls，就保留 `...basicFunctions`。

## 自定义组件

组件可以是任何接收单个 props object 并返回 `ReactNode` 的函数。函数名（或
`displayName`）就是 Agent 使用的协议名：

```tsx
function MyChart(props: { data: number[] }) { ... }
// 生产安全命名需要 displayName。minifier 会重写 function 名称，但字符串
// 字面量会保留下来。
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} ... />
// Agent sends `{ component: 'MyChart', data: [...] }` -> renders MyChart.
```

如果自定义组件需要 schema introspection，请用
`@lynx-js/genui/a2ui-catalog-extractor` 基于 interface 生成 manifest，然后用同样方式
配对：

```tsx
defineCatalog([[MyChart, myChartManifest]]);
```

## API surface

- `defineCatalog(inputs)`：构建 runtime catalog。输入可以混合 bare
  components、`[component, manifest]` tuples，以及已经 resolved 的 entries
  （例如来自 `mergeCatalogs`）。
- `mergeCatalogs(...catalogs)`：重复名称采用 last-write-wins。
- `serializeCatalog(catalog)`：输出发给 Agent handshake 的 JSON manifest。
  没有关联 schema 的 component 会序列化成 `{ name }`。
- `resolveCatalog(catalog)`：生成 name -> component map。Renderer 内部使用，
  也开放给高级场景。
