# @lynx-js/react-alias-rsbuild-plugin

## 0.12.8

## 0.12.7

## 0.12.6

## 0.12.5

## 0.12.4

## 0.12.3

## 0.12.2

## 0.12.1

## 0.12.0

### Minor Changes

- **BREAKING CHANGE**: Use resolver from Rspack. ([#1964](https://github.com/lynx-family/lynx-stack/pull/1964))

  The `createLazyResolver` now requires an `rspack` parameter:

  ```diff
  - function createLazyResolver(directory: string, conditionNames: string[]): (request: string) => Promise<string>;
  + function createLazyResolver(rspack: rspack, directory: string, conditionNames: string[]): (request: string) => Promise<string>;
  ```

### Patch Changes

- Support Yarn Plug'n'Play. ([#1964](https://github.com/lynx-family/lynx-stack/pull/1964))

## 0.11.4

## 0.11.3

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.14

### Patch Changes

- Allow customization of the react$ alias. ([#1653](https://github.com/lynx-family/lynx-stack/pull/1653))

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    resolve: {
      alias: {
        react$: '@lynx-js/react/compat',
      },
    },
  })
  ```

## 0.10.13

### Patch Changes

- Support using multiple times in different environments. ([#1498](https://github.com/lynx-family/lynx-stack/pull/1498))

- Alias `@lynx-js/preact-devtools` to `false` to reduce an import of empty webpack module. ([#1593](https://github.com/lynx-family/lynx-stack/pull/1593))

## 0.10.12

## 0.10.11

### Patch Changes

- Fix the `Package subpath './compat' is not defined by "exports"` error. ([#1460](https://github.com/lynx-family/lynx-stack/pull/1460))

## 0.10.10

## 0.10.9

### Patch Changes

- Add alias for `@lynx-js/react/compat`. ([#1316](https://github.com/lynx-family/lynx-stack/pull/1316))

## 0.10.8

### Patch Changes

- Support `@lynx-js/react/debug`. ([#1250](https://github.com/lynx-family/lynx-stack/pull/1250))

## 0.10.7

## 0.10.6

## 0.10.5

## 0.10.4

### Patch Changes

- Replace `enhanced-resolve` with `unrs-resolver` ([#936](https://github.com/lynx-family/lynx-stack/pull/936))

## 0.10.3

## 0.10.2

### Patch Changes

- Resolve runtime packages in parallel using `Promise.all`. ([#955](https://github.com/lynx-family/lynx-stack/pull/955))

## 0.10.1

## 0.10.0

## 0.9.10

## 0.9.9

## 0.9.8

### Patch Changes

- Refactor: Replace built-in `background-only` implementation with npm package ([#602](https://github.com/lynx-family/lynx-stack/pull/602))

  Previously we maintained custom files:

  - `empty.ts` for background thread
  - `error.ts` for main thread validation

  Now adopting the standard `background-only` npm package

## 0.9.7

## 0.9.6

## 0.9.5

## 0.9.4

## 0.9.3

### Patch Changes

- Fix the issue where the canary version of React was not included in the `rule.include` configuration. ([#275](https://github.com/lynx-family/lynx-stack/pull/275))

## 0.9.2

## 0.9.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.9.0

## 0.8.1

## 0.8.0

## 0.7.0

## 0.6.5

## 0.6.4

## 0.6.3

## 0.6.2

## 0.6.1

## 0.6.0

## 0.5.2

## 0.5.1

### Patch Changes

- 2077e5e: Ensure only alias once for different version of alias plugins

## 0.5.0

### Patch Changes

- 15a9a34: Ensure alias only applied once.
- 4ef9d17: Move alias to a standalone plugin.
