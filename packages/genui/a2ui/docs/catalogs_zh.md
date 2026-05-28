# Catalogs 和 manifests

Catalog 定义 renderer 可以使用哪些 protocol components 和 functions。它也可以
提供 Agent handshake 所需的 JSON schemas。

## 从 renderer-only components 开始

如果你的应用只负责渲染，可以直接传 bare components。协议名来自
`displayName ?? component.name`。

```ts
import { defineCatalog, Text, Button } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([Text, Button]);
```

生产环境 minifier 可能改写 function 名称。为了生产安全，请给每个自定义组件
设置显式 `displayName`，或者把组件与它的 `catalog.json` manifest 配对使用。
manifest 的顶层 key 是权威名称。

## 为 Agent handshake 加入 manifests

如果你希望 `serializeCatalog(...)` 为每个组件输出 JSON Schema，请把组件和
`dist/catalog/<Name>/catalog.json` 产出的 JSON 配对：

```ts
import { Text, defineCatalog, serializeCatalog } from '@lynx-js/genui/a2ui';
import textManifest from '@lynx-js/genui/a2ui/catalog/Text/catalog.json'
  with { type: 'json' };

const catalog = defineCatalog([[Text, textManifest]]);
agentChannel.handshake({ catalog: serializeCatalog(catalog) });
```

## Messages 使用 function calls 时加入 basic functions

A2UI messages 可能使用 `formatDate`、`formatString` 或 `required` 这样的
basic-catalog function calls。请在同一个 catalog input 列表里加入
`...basicFunctions`，这样客户端才能在渲染时执行这些 function。

```ts
import { Text, basicFunctions, defineCatalog } from '@lynx-js/genui/a2ui';

const catalog = defineCatalog([
  Text,
  ...basicFunctions,
]);
```

## 没有 `catalog/all`

这个包故意不提供 `catalog/all` 聚合导出。一个引用所有组件的顶层数组会迫使
消费者打包全部内置组件，即使实际只渲染其中几个。请在接入点显式组合 catalog，
让 bundle 成本保持可见。

完整 “every built-in” 配方见
[../src/catalog/readme_zh.md](../src/catalog/readme_zh.md)。
