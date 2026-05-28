# 自定义组件

任何返回 `ReactNode` 的函数都可以成为 catalog component。函数名，或它的
`displayName`，就是 Agent 会使用的协议名。

```tsx
function MyChart(props: { data: number[] }) { ... }
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} ... />;
// Agent emits `{ component: 'MyChart', data: [...] }` -> renders MyChart.
```

为了生产安全，请设置 `displayName`。Minifier 可能改写 function 名称，但字符串
字面量会保留下来。

## 加入 schema introspection

如果 Agent 需要知道组件 props，请使用 `@lynx-js/genui/a2ui-catalog-extractor` 生成
manifest，并把 manifest 与组件配对。

```tsx
import myChartManifest from './dist/catalog/MyChart/catalog.json' with {
  type: 'json',
};

const catalog = defineCatalog([
  [MyChart, myChartManifest],
]);
```

在描述 Agent 可见 props 的 TypeScript interface 上使用
`@a2uiCatalog <ComponentName>`。Extractor 详情见
[`@lynx-js/genui/a2ui-catalog-extractor`](../../a2ui-catalog-extractor/readme.zh_cn.md)。
