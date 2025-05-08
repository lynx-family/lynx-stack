# background-only

This package serves as a mark package to enforce and mark modules that should only be used in the Background Thread context. It provides type definitions and runtime checks to ensure proper usage.

## Example Usages

Say we have a `Logger` module that has side effects calling into Native Modules or other APIs that are only available in the "Background" environment:

```tsx
// Logger.js
import "background-only";

export function log(msg) {
  // Notice how we are calling into NativeModules here.
  NativeModules.hybridMonitor.reportJSError(...);
}
```

By adding `import "background-only"` to poison this module, we are now declaring that this module is only safe to be bundled in a "Background" environment, protecting this module from being accidentally bundled into a "Main thread" environment by throwing an error at runtime.

For example, if we use `log` in a desirable position from a React component, such as in `useEffect` or an event handler, the `log` will work as expected:

```tsx
// App.jsx
import { log } from "./Logger";

function App() {
  useEffect() {
    log();
  }
  return <view />
}
```

However, if we use `log` in a undesirable position from a React component, such as in the body of the rendering function, it will throw an error at runtime time:

```tsx
// App.jsx
import { log } from './Logger';

function App() {
  // throw!
  log();
  return <view />;
}
```

## Development Note

This package is already in its final form and does not require build or test steps. The files are simple enough to be used as-is.

The package consists of three files in their final form:

- `error.js` - Throws an error when imported in the wrong context
- `empty.js` - An empty module for the default export
- `index.d.ts` - TypeScript type definitions (empty)

## Credits

This is inspired by the [`server-only`](https://www.npmjs.com/package/server-only?activeTab=readme) package of React.
