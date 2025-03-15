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

Rspeedy by default reads the `tsconfig.json` file from the root directory. You can use the [source.tsconfigPath](../api/rspeedy.source.tsconfigpath) to configure a custom tsconfig.json file path.

```ts
export default {
  source: {
    tsconfigPath: './tsconfig.custom.json',
  },
};
```

## Rspeedy type declaration

Rspeedy provide various built-in features like [CSS Modules](./css.mdx#using-css-modules) and [Static Assets](./assets.md). TypeScript does not know about these features and the corresponding type declarations.

To solve this, create a `src/rspeedy-env.d.ts` file, and add the following content:

```typescript title=src/rspeedy-env.d.ts
/// <reference types="@lynx-js/rspeedy/client" />
```

:::tip
`create-rspeedy-app` will automatically create this file for you.
:::

## TypeScript Transpilation

Rsbuild uses SWC for transforming TypeScript code.

### isolatedModules

Unlike the native TypeScript compiler, tools like SWC and Babel compile each file separately and cannot determine whether an imported name is a type or a value. Therefore, when using TypeScript in Rspeedy, you need to enable the [isolatedModules](https://typescriptlang.org/tsconfig/#isolatedModules) option in your `tsconfig.json` file:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

:::tip
`create-rspeedy` will automatically include this for you.
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

Rsbuild provides the [Type Check plugin](https://rsbuild.dev/plugins/list/plugin-type-check), which runs TypeScript type checking in a separate process. The plugin internally integrates [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin).

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

Please refer to the [Type Check plugin](https://rsbuild.dev/plugins/list/plugin-type-check) for more available options.
