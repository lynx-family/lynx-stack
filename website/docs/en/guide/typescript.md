# TypeScript

Powered by Rsbuild, Rspeedy supports TypeScript by default, allowing you to directly use `.ts` and `.tsx` files in your projects.

## Path Alias

Path aliases allow developers to define aliases for modules, making it easier to reference them in code. This can be useful when you want to use a short, easy-to-remember name for a module instead of a long, complex path.

For example, if you frequently reference the `src/common/request.ts` module in your project, you can define an alias for it as `@request` and then use import request from `'@request'` in your code instead of writing the full relative path every time. This also allows you to move the module to a different location without needing to update all the import statements in your code.

The [`paths`](https://www.typescriptlang.org/tsconfig/#paths) option of TypeScript is recommended to be used to make path aliases.

```json title=tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["./src/common/*"]
    }
  }
}
```

After configuring, if you reference `@common/request.ts` in your code, it will be mapped to the `<project>/src/common/request.ts` path.

<!-- eslint-disable-next-line import/no-unresolved -->

```js
import { get } from '@common/request.js'; // The same as './common/request.js'
```

## Custom `tsconfig.json` Path

Rspeedy by default reads the `tsconfig.json` file from the root directory. You can use the [source.tsconfigPath](../api/rspeedy.source.tsconfigpath.md) to configure a custom tsconfig.json file path.

```ts
export default {
  source: {
    tsconfigPath: './tsconfig.custom.json',
  },
};
```

## Rspeedy type declaration

Rspeedy provide various built-in features like CSS Modules and [Static Assets](./assets.md). TypeScript does not know about these features and the corresponding type declarations.

To solve this, add `@lynx-js/rspeedy/client` to the `types` array in `tsconfig.json`, keeping the entries already there:

```json title=tsconfig.json
{
  "compilerOptions": {
    "types": ["@lynx-js/rspeedy/client"]
  }
}
```

:::tip
[`create-lynx`](https://www.npmjs.com/package/@lynx-js/create-lynx) will automatically include this for you.
:::

## Extending Lynx types

Lynx provides default types, but you may need to extend or customize certain type definitions for your application.

- [`GlobalProps`](#globalprops): extends the type definition for `lynx.__globalProps`
- [`InitData`](#initdata): extends the return type of [`useInitData()`](https://lynxjs.org/api/react/Function.useInitData.mdx)
- [`IntrinsicElements`](#intrinsicelements): extends the type definition for elements (e.g: you may have your own `<input>` element)
- [`NativeModules`](#nativemodules): extends the type definition for [custom native modules](https://lynxjs.org/guide/use-native-modules.mdx).

### GlobalProps

You can extend the `interface GlobalProps` from `@lynx-js/types` to add custom properties:

```ts title="src/global-props.d.ts"
declare module '@lynx-js/types' {
  interface GlobalProps {
    foo: string;
    bar: number;
  }
}

export {}; // This export makes the file a module
```

After this extension, TypeScript will recognize and provide type checking for `lynx.__globalProps.foo` and `lynx.__globalProps.bar`.

### InitData

You can extend the `interface InitData` from `@lynx-js/react` to add your custom data properties:

```ts title="src/init-data.d.ts"
declare module '@lynx-js/react' {
  interface InitData {
    foo: string;
    bar: number;
  }
}

export {}; // This export makes the file a module
```

With this extension, TypeScript will provide type checking for `useInitData().foo` and `useInitData().bar` in your components.

### IntrinsicElements

You can extends the `interface IntrinsicElements` from `@lynx-js/types` to add your [custom native element](https://lynxjs.org/guide/custom-native-component.mdx)

Here is an example for a `<input>` element with required `type` and optional `bindinput` and `value`.

<!-- eslint-disable import/no-unresolved -->

```ts title="src/intrinsic-element.d.ts"
import * as Lynx from '@lynx-js/types';

declare module '@lynx-js/types' {
  interface IntrinsicElements extends Lynx.IntrinsicElements {
    input: {
      bindinput?: (e: { type: 'input'; detail: { value: string } }) => void;
      type: string;
      value?: string | undefined;
    };
  }
}
```

### NativeModules

You can extend the `interface NativeModules` from `@lynx-js/types` to add custom [native modules](https://lynxjs.org/guide/use-native-modules.mdx):

Here is an example for a `NativeLocalStorageModule` with 3 methods:

```ts title="src/native-modules.d.ts"
declare module '@lynx-js/types' {
  interface NativeModules {
    NativeLocalStorageModule: {
      clearStorage(): void;
      getStorageItem(key: string): string | null;
      setStorageItem(key: string, value: string): void;
    };
  }
}

export {}; // This export makes the file a module
```

## TypeScript Transpilation

Rsbuild uses SWC for transforming TypeScript code.

### isolatedModules

Unlike the native TypeScript compiler, tools like SWC and Babel compile each file separately and cannot determine whether an imported name is a type or a value. Therefore, when using TypeScript in Rspeedy, you need to enable the [isolatedModules](https://typescriptlang.org/tsconfig/#isolatedModules) option in your `tsconfig.json` file:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "isolatedModules": true // [!code focus]
  }
}
```

:::tip
[`create-lynx`](https://www.npmjs.com/package/@lynx-js/create-lynx) will automatically include this for you.
:::

This option can help you avoid using certain syntax that cannot be correctly compiled by SWC and Babel, such as cross-file type references. It will guide you to correct the corresponding usage:

<!-- eslint-disable import/no-unresolved, import/export -->

```ts
// ❌ Wrong
export { SomeType } from './types.js';

// ✅ Correct
export type { SomeType } from './types.js';

// ✅ Correct
export { type SomeType } from './types.js';
```

## Type Checking

Type checking is not performed.

Rsbuild provides the [Type Check plugin](https://rsbuild.rs/guide/basic/typescript#type-checking), which runs TypeScript type checking in a separate process. The plugin internally integrates [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin).

1. Install the `@rsbuild/plugin-type-check` package

```bash
pnpm add -D @rsbuild/plugin-type-check
```

2. Add `@rsbuild/plugin-type-check` to `lynx.config.ts`

```js title=lynx.config.ts
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginTypeCheck({
      enable: true,
    }),
  ],
});
```

Please refer to the [Type Check plugin](https://rsbuild.rs/guide/basic/typescript#type-checking) for more available options.
