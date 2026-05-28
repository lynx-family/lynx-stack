# Custom components

Any function returning a `ReactNode` can be a catalog component. The function's
name, or its `displayName`, is the protocol name the Agent will use.

```tsx
function MyChart(props: { data: number[] }) { ... }
MyChart.displayName = 'MyChart';

<A2UI catalogs={[Text, Button, MyChart]} ... />;
// Agent emits `{ component: 'MyChart', data: [...] }` -> renders MyChart.
```

Set `displayName` for production-safe naming. Minifiers can rewrite function
names, but string literals survive.

## Add schema introspection

If the Agent needs to know the component's props, generate a manifest with
`@lynx-js/genui/a2ui-catalog-extractor` and pair it with the component.

```tsx
import myChartManifest from './dist/catalog/MyChart/catalog.json' with {
  type: 'json',
};

const catalog = defineCatalog([
  [MyChart, myChartManifest],
]);
```

Use `@a2uiCatalog <ComponentName>` on the TypeScript interface that describes
the props you want the Agent to see. For extractor details, see
[`@lynx-js/genui/a2ui-catalog-extractor`](../../a2ui-catalog-extractor/README.md).
