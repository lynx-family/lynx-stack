# TypeScript

Rspeedy 基于 Rsbuild 原生支持 TypeScript，允许你在项目中直接使用 `.ts` 和 `.tsx` 文件。

## 路径别名

路径别名允许开发者定义模块的别名，使代码中引用模块更加方便。当你需要频繁引用某个模块时，可以用简短的别名替代冗长的相对路径。

例如，如果你经常引用项目中的 `src/common/request.ts` 模块，可以为其定义别名 `@common`，然后在代码中使用 `import request from '@common/request.js'` 替代完整的相对路径。当模块位置变更时，也无需修改所有导入语句。

推荐使用 TypeScript 的 [`paths`](https://www.typescriptlang.org/tsconfig/#paths) 配置项来设置路径别名。

```json title=tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["./src/common/*"]
    }
  }
}
```

配置后，当代码中引用 `@common/request.ts` 时，将会映射到 `<project>/src/common/request.ts` 路径。

<!-- eslint-disable-next-line import/no-unresolved -->

```js
import { get } from '@common/request.js'; // 等同于 './common/request.js'
```

## 自定义 tsconfig.json 路径

Rspeedy 默认会读取根目录下的 `tsconfig.json` 文件。你可以通过 [source.tsconfigPath](../../api/rspeedy.source.tsconfigpath) 配置自定义的 `tsconfig.json` 文件路径。

```ts
export default {
  source: {
    tsconfigPath: './tsconfig.custom.json',
  },
};
```

## Rspeedy 类型声明

Rspeedy 提供了 CSS Modules、[静态资源](./assets.md)等内置功能，这些功能需要添加对应的类型声明。

请创建 `src/rspeedy-env.d.ts` 文件，并添加以下内容：

```typescript title=src/rspeedy-env.d.ts
/// <reference types="@lynx-js/rspeedy/client" />
```

:::tip
[`create-rspeedy`](https://npmjs.com/create-rspeedy) 在创建项目时会自动生成该文件。
:::

## TypeScript 编译

Rsbuild 使用 SWC 来编译 TypeScript 代码。

### isolatedModules

与原生 TypeScript 编译器不同，SWC 和 Babel 等工具会单独编译每个文件，无法判断导入的名称是类型还是值。因此在使用 Rspeedy 时需要开启 [isolatedModules](https://typescriptlang.org/tsconfig/#isolatedModules) 配置：

```json title="tsconfig.json"
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

:::tip
[`create-rspeedy`](https://npmjs.com/create-rspeedy) 在创建项目时会自动包含该配置。
:::

该选项可以帮助你避免使用某些无法被 SWC 正确编译的语法（如跨文件类型引用），并指导你修正对应的用法：

<!-- eslint-disable import/no-unresolved, import/export -->

```ts
// ❌ 错误
export { SomeType } from './types.js';

// ✅ 正确
export type { SomeType } from './types.js';

// ✅ 正确
export { type SomeType } from './types.js';
```

## 类型检查

默认情况下 Rspeedy 不会执行类型检查。如果需要类型检查功能，可以使用 Rsbuild 提供的 [Type Check 插件](https://rsbuild.dev/plugins/list/plugin-type-check)，该插件会在独立进程中运行 TypeScript 类型检查（内部集成了 [fork-ts-checker-webpack-plugin](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin)）。

1. 安装插件包

```bash
pnpm add -D @rsbuild/plugin-type-check
```

2. 在配置文件中添加插件

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

完整配置选项请参考 [Type Check 插件文档](https://rsbuild.dev/plugins/list/plugin-type-check)。
