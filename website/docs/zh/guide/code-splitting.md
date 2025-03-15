# 代码拆分

> Rspack 支持代码分割特性，允许让你对代码进行分割，控制生成的资源体积和资源数量来获取资源加载性能的提升。
>
> [Rspack - 代码分割](https://rspack.dev/zh/guide/optimization/code-splitting)

## 懒加载组件

通常，我们使用静态 import 来导入组件：

<!-- eslint-disable import/no-unresolved -->

```jsx
import LazyComponent from './LazyComponent.jsx';

export function App() {
  return (
    <view>
      <LazyComponent />
    </view>
  );
}
```

如果要将“加载组件代码”延迟至该组件被渲染时，可以将此 import 替换为：

<!-- eslint-disable import/no-unresolved -->

```diff
- import LazyComponent from './LazyComponent.jsx'
+ import { lazy } from '@lynx-js/react'
+ const LazyComponent = lazy(() => import('./LazyComponent.jsx'))
```

此代码依赖于[动态 import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)。使用此模式要求导入的懒加载组件必须作为默认导出（Default Export）进行导出。

现在，由于你的组件代码按需加载，你还需要指定在加载期间应显示的内容。你可以通过将懒加载组件或其任何父组件包装在 `<Suspense>` 边界中来实现这一点：

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/App.tsx"
import { Suspense, lazy } from '@lynx-js/react';

const LazyComponent = lazy(() => import('./LazyComponent.jsx'));

export function App() {
  return (
    <view>
      <Suspense fallback={<text>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  );
}
```

### 按需懒加载

在此示例中，`LazyComponent` 的代码在尝试渲染它之前不会被加载。如果 `LazyComponent` 尚未加载，则会在其位置显示“Loading...”。例如：

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/App.tsx"
import { Suspense, lazy, useState } from '@lynx-js/react';

const LazyComponent = lazy(() => import('./LazyComponent.jsx'));

export function App() {
  const [shouldDisplay, setShouldDisplay] = useState(false);
  const handleClick = () => {
    setShouldDisplay(true);
  };
  return (
    <view>
      <view bindtap={handleClick}>Load Component</view>
      {shouldShow && (
        <Suspense fallback={<text>Loading...</text>}>
          <LazyComponent />
        </Suspense>
      )}
    </view>
  );
}
```

### 错误处理

#### 使用 ErrorBoundary

如果加载完成，懒加载组件本质上也是一个 React 组件，因此 React 中的错误处理实践仍然适用。

细节请参考 [React - Catching rendering errors with an error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

## 懒加载独立项目

你还可以延迟加载在独立的 Rspeedy 项目中构建的模块。

### 术语表

- 生产者：一个向其他 Lynx 应用程序提供模块以供使用的应用程序。
- 消费者：一个从其他生产者中消费模块的应用程序。

### 创建一个独立的生产者项目

使用 [`create-rspeedy`](https://npmjs.com/create-rspeedy) 创建一个独立项目：

```bash
pnpm create rspeedy@latest
```

在 `lynx.config.js` 中将 `pluginReactLynx` 的 [`experimental_isLazyBundle`] 选项设置为 `true`：

```js
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: './src/index.tsx',
  },
  plugins: [
    pluginReactLynx({
      experimental_isLazyBundle: true,
    }),
  ],
});
```

最后修改 `src/index.tsx` 来导出 `App` 组件：

<!-- eslint-disable-next-line import/no-unresolved -->

```js title="src/index.tsx"
import { App } from './App.jsx';

export default App;
```

### 修改消费者项目

要加载 Producer 项目，请在入口的开头添加对 `@lynx-js/react/experimental/lazy/import` 的导入：

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/index.tsx"
import '@lynx-js/react/experimental/lazy/import';
import { root } from '@lynx-js/react';

import { App } from './App.jsx';

root.render(<App />);
```

这将提供生产者所需的基本 API。

然后，可以使用[动态 import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) 加载生产者：

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/App.tsx"
import { Suspense, lazy } from '@lynx-js/react';

const LazyComponent = lazy(
  () =>
    import('https://<host>:<port>/path/to/[name]lynx.bundle', {
      with: { type: 'component' },
    }),
);

export function App() {
  return (
    <view>
      <Suspense fallback={<text>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </view>
  );
}
```

### 开发生产者项目

建议在生产者项目中创建一个单独的消费者入口：

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/Consumer.tsx"
import { Suspense, lazy, root } from '@lynx-js/react';

// You may use static import if you want
const App = lazy(() => import('./App.jsx'));

root.render(
  <Suspense>
    <App />
  </Suspense>,
);
```

然后，创建一个单独的 `lynx.config.consumer.js`：

```js title="lynx.config.consumer.js"
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: './src/Consumer.tsx',
  },
  plugins: [pluginReactLynx()],
});
```

使用 `npx rspeedy dev --config lynx.config.consumer.js` 来开始开发生产者项目。

[`experimental_isLazyBundle`]: ../../api/react-rsbuild-plugin.pluginreactlynxoptions.experimental_islazybundle
