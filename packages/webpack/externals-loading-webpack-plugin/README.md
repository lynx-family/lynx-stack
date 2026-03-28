<h2 align="center">@lynx-js/externals-loading-webpack-plugin</h2>

A webpack plugin to support loading externals in Lynx.

## When to use this package

Most applications should use
`@lynx-js/external-bundle-rsbuild-plugin`, which expands presets and handles
development serving and build-time asset emission.

Use `@lynx-js/externals-loading-webpack-plugin` directly only when you need the
low-level webpack/Rspack runtime integration.

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
