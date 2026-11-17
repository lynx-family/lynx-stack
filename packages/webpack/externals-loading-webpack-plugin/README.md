<h2 align="center">@lynx-js/externals-loading-webpack-plugin</h2>

A webpack plugin to support loading externals in Lynx.

## When to use this package

Most applications should use
`@lynx-js/external-bundle-rsbuild-plugin`, which expands presets and handles
development serving and build-time asset emission.

Use `@lynx-js/externals-loading-webpack-plugin` directly only when you need the
low-level webpack/Rspack runtime integration.

Fixed-URL and `bundlePath` bundles are prefetched during startup, but their sections
are evaluated on the first import. This preserves module initialization order,
including initializing a page's worklet runtime before importing a legacy
component external. Synchronous exports and asynchronous loading Promises are
cached on first access; host-provided exports are preserved. Repeated access does
not execute the section again, including while an asynchronous load is pending.
This does not serialize asynchronous sibling modules: if an initializer awaits
another module, consumers must explicitly depend on its completion.

Function-valued `url` resolvers are deferred until the first import, including
the fetch itself. Concurrent imports share the pending request. A resolver may
return a string or a Promise of a string. Optional `load(response, sectionPath)`
callbacks control section evaluation and receive unsuccessful responses too.
Both callbacks require `async: true` (the default), are serialized into each
realm, and cannot capture build-time variables. Native request rejections are
propagated to the importing module; rejected imports remain cached.

For loaders that need normal imports or per-container state, use a `runtime`
module instead. Do not combine a runtime module with URL resolver or load
callbacks; fixed `url` strings and `bundlePath` remain valid runtime inputs.

## Usage

```ts
import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin';

export default {
  plugins: [
    new ExternalsLoadingPlugin({
      backgroundLayer: 'BACKGROUND_LAYER',
      mainThreadLayer: 'MAIN_THREAD_LAYER',
      externals: {
        './App.js': {
          libraryName: './App.js',
          bundlePath: 'comp-lib.lynx.bundle',
          background: { sectionPath: './App.js' },
          mainThread: { sectionPath: './App.js__main-thread' },
          async: true,
        },
        '@lynx-js/react': {
          libraryName: ['ReactLynx', 'React'],
          bundlePath: 'react.lynx.bundle',
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
      },
    }),
  ],
};
```

### `bundlePath` vs `url`

- `bundlePath` is preferred for bundles that should resolve from the runtime
  public path.
- `url` is only needed when the external bundle is hosted outside the current
  build output.

### Runtime loading selection

`async` also accepts a standalone callback, for example
`async: ({ systemInfo }) => ['Harmony', 'web'].includes(String(systemInfo['platform']))`.
It runs in the generated runtime with `SystemInfo` (falling back to
`lynx.SystemInfo` or `{}`). The callback must return a boolean synchronously and
cannot capture build-time imports or variables. Use an arrow or function
expression. Callback externals always use promise module semantics, including
when synchronous loading is selected. Boolean options retain their behavior.
