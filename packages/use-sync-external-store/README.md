# @lynx-js/use-sync-external-store

This is a pure ESM fork of the [`use-sync-external-store`](https://www.npmjs.com/package/use-sync-external-store) package specifically adapted for using with [ReactLynx](https://lynxjs.org/react).

## Background

The original `use-sync-external-store` package works with ReactLynx but has some limitations:

1. Only CommonJS (CJS) exports are supported, which results in the [`concatenateModules`](https://rspack.rs/config/optimization#optimizationconcatenatemodules) optimization bailout for `@lynx-js/react` (a dependency of use-sync-external-store), leading to increased bundle size and slower execution.
2. Default import of React is used, which results in the whole `@lynx-js/react` being bundled, making the [`usedExports`](https://rspack.rs/config/optimization#optimizationusedexports) optimization ineffective.

Since `use-sync-external-store` is used in popular libraries like [Zustand](https://github.com/pmndrs/zustand), we provide our own version to ensure optimal performance and bundle size when using these libraries with ReactLynx.

### Changes from Original Package

- Use `@lynx-js/react` instead of `react`
- Use named import instead of default import
- Export pure ESM instead of CommonJS

## Usage

This package is designed to be used as a drop-in replacement for libraries that import `useSyncExternalStore` hooks directly from the `use-sync-external-store` package. It's intended to be used as a bundler-level alias to preserve optimizations that would otherwise be lost due to the original package being CJS and default importing React.

### Configuration

Add the following alias configuration to your bundler (e.g., Rspack):

```js
// rspack.config.js
export default {
  resolve: {
    alias: {
      'use-sync-external-store': '@lynx-js/use-sync-external-store',
    },
  },
};
```

No code changes are required for end developers - the package maintains the exact same API as the original.

## License

MIT License

Copyright (c) 2025 Meta Platforms, Inc. and affiliates.
Copyright (c) 2025 Lynx Authors.
