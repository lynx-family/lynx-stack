# @lynx-js/test-environment

`@lynx-js/test-environment` is a pure-JavaScript implementation of the [Lynx Spec](https://lynxjs.org/api/engine/element-api), notably the [Element PAPI](https://lynxjs.org/api/engine/element-api) and [Dual-threaded Model](https://lynxjs.org/guide/spec#dual-threaded-model) for use with Node.js. In general, the goal of the project is to emulate enough of a subset of a Lynx environment to be useful for testing.

The Element PAPI implementation is based on jsdom, for example `__CreateElement` will return a `LynxElement`, which extends `HTMLElement` from jsdom. You can reuse the testing utilities that are commonly used for DOM testing, such as [`@testing-library/dom`](https://github.com/testing-library/dom-testing-library) (for DOM querying) and [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) (custom jest matchers for the DOM), etc.

## Usage

```js
import { LynxEnv } from '@lynx-js/test-environment';

const lynxEnv = new LynxEnv();
```

To use `@lynx-js/test-environment`, you will primarily use the `LynxEnv` constructor, which is a named export of the package. You will get back a `LynxEnv` instance, which has a number of methods of useful properties, notably `switchToMainThread` and `switchToBackgroundThread`, which allow you to switch between the main thread and background thread.

Use the background thread API:

```js
lynxEnv.switchToBackgroundThread();
// use the background thread global object
globalThis.lynxCoreInject.tt.OnLifecycleEvent(...args);
// or directly use `lynxCoreInject` since it's already injected to `globalThis`
// lynxCoreInject.tt.OnLifecycleEvent(...args);
```

Use the main thread API:

```js
lynxEnv.switchToMainThread();
// use the main thread Element PAPI
const page = __CreatePage('0', 0);
const view = __CreateView(0);
__AppendElement(page, view);
```

Note that you can still access the other thread's globals without switching threads:

```js
lynxEnv.switchToMainThread();
// use the `backgroundThread` global object even though we're on the main thread
lynxEnv.backgroundThread.tt.OnLifecycleEvent(...args);
```

### Use in Vitest

It is recommended to configure as Vitest's [test environment](https://vitest.dev/guide/environment), for example:

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: require.resolve(
      '@lynx-js/test-environment/env/vitest',
    ),
  },
});
```

After configuration, you can directly access the `lynxEnv` object globally in the test.

If you want to use `@lynx-js/test-environment` for unit testing in ReactLynx, you usually don't need to specify this configuration manually.

Please refer to [ReactLynx Testing Library](https://lynxjs.org/react/react-lynx-testing-library.html) to inherit the configuration from `@lynx-js/react/testing-library`.

## Credits

Thanks to:

- [jsdom](https://github.com/jsdom/jsdom) for the pure-JavaScript implementation of DOM API.
