# Code Splitting

:::warning 🚧 WARNING
Code Splitting is an experimental feature in Rspeedy.
:::

> Rspack supports code splitting, which allows splitting the code into other chunks. You have the full control about size and number of generated assets, which allow you to gain performance improvements in loading time.
>
> [Rspack - Code Splitting](https://rspack.dev/guide/optimization/code-splitting)

## Lazy-loading components

Usually, you import components with the static import declaration:

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

To defer loading this component’s code until it’s rendered for the first time, replace this import with:

<!-- eslint-disable import/no-unresolved -->

```diff
- import LazyComponent from './LazyComponent.jsx'
+ import { lazy } from '@lynx-js/react'
+ const LazyComponent = lazy(() => import('./LazyComponent.jsx'))
```

This code relies on [dynamic `import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), which is supported by Rspack. Using this pattern requires that the lazy component you are importing was exported as the default export.

Now that your component’s code loads on demand, you also need to specify what should be displayed while it is loading. You can do this by wrapping the lazy component or any of its parents into a `<Suspense>` boundary:

:::info
The split components will only start downloading when they are rendered.
:::

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

### Load lazy component when needed

In this example, the code for `LazyComponent` won’t be loaded until you attempt to render it. If `LazyComponent` hasn’t loaded yet, a "Loading..." will be shown in its place. For example:

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

### Error handling

#### Use ErrorBoundary

If loading is completed, lazy-loaded components are essentially also a React component, so the error handling practices in React are still applicable.

Checkout [React - Catching rendering errors with an error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) for details.

## Lazy-loading standalone project

You may also lazy-load modules that being built in a standalone Rspeedy project.

### Glossary of Terms

- Producer (Remote): An application that exposes modules to be consumed by other Lynx applications.
- Consumer (Host): An application that consumes modules from other Producers.

### Create a standalone Producer project

Create a standalone project using [`create-rspeedy`](https://npmjs.org/package/create-rspeedy):

```bash
npm create rspeedy@latest
```

Then add [`experimental_isLazyBundle`] to the options of `pluginReactLynx` in the `lynx.config.js`:

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

Finally, change the `index.tsx` to export the `App`.

<!-- eslint-disable-next-line import/no-unresolved -->

```js title="src/index.tsx"
import { App } from './App.jsx';

export default App;
```

### Modify the Consumer project

To load the Producer project, add an import to `@lynx-js/react/experimental/lazy/import` at the beginning of the entry.

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/index.tsx"
import '@lynx-js/react/experimental/lazy/import';
import { root } from '@lynx-js/react';

import { App } from './App.jsx';

root.render(<App />);
```

This would provide essential APIs that the Producer needs.

Then, the Producer could be loaded using [dynamic `import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).

<!-- eslint-disable import/no-unresolved -->

```jsx title="src/App.tsx"
import { Suspense, lazy } from '@lynx-js/react';

const LazyComponent = lazy(() =>
  import('https://<host>:<port>/path/to/template.js', {
    with: { type: 'component' },
  })
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

### Developing Producer project

It is recommended to create a separated Consumer in the Producer project.

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

Then, create a separated `lynx.config.consumer.js`:

```js title="lynx.config.consumer.js"
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: './src/Consumer.tsx',
  },
  plugins: [
    pluginReactLynx(),
  ],
});
```

Use `npx rspeedy dev --config lynx.config.consumer.js` to start developing the producer project.

[`experimental_isLazyBundle`]: ../api/react-rsbuild-plugin.pluginreactlynxoptions.experimental_islazybundle
