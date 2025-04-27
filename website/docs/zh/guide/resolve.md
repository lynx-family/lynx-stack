# 模块解析

在现代前端开发中，模块化已成为有效管理代码的关键方式：

1. **简化模块导入**：

   - 模块解析允许使用简洁易读的路径进行模块导入，替代冗长的相对路径。例如通过别名配置，可以使用 `@components/Button` 代替 `../../../src/components/Button`，显著提升代码可维护性。

2. **环境感知的模块替换**：
   - 模块解析支持根据环境（如开发/生产环境、Lynx/浏览器环境）加载不同版本的模块。可以轻松实现环境感知的模块替换，确保不同场景下使用最合适的依赖。

## 路径别名

路径别名允许开发者为模块定义简短的别名，方便在代码中引用。当需要频繁引用某个模块时，这能有效避免每次都要书写冗长的相对路径。

例如，若项目中经常引用 `src/common/request.ts` 模块，可以为其定义别名 `@request`，后续在代码中即可使用 `import request from '@request'` 代替完整相对路径。这也使得模块位置变更时无需修改所有导入语句。

### 使用 `tsconfig.json` 的 `paths` 配置

推荐在 TypeScript 项目中通过 `tsconfig.json` 的 `paths` 配置别名，这种方式能同时解决路径别名的 TS 类型问题。

示例配置：

```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["./src/common/*"]
    }
  }
}
```

配置后，代码中引用 `@common/Foo.tsx` 将被映射到 `<项目根目录>/src/common/Foo.tsx` 路径。

:::tip
更多细节可参考 [TypeScript - paths](https://typescriptlang.org/tsconfig#paths) 官方文档。
:::

### 使用 `source.alias` 配置

Rsbuild 提供 [source.alias](../../api/rspeedy.source.alias) 配置项，对应 webpack/Rspack 原生的 [resolve.alias](https://rspack.dev/config/resolve#resolvealias) 配置。可通过对象或函数形式进行配置。

#### 使用场景

`tsconfig.json` 的 `paths` 配置是静态的，缺乏动态性。且 `paths` 仅在模块被包含在 [`source.include`](../../api/rspeedy.source.include) 时生效。

`source.alias` 配置能突破这些限制，允许通过 JavaScript 代码动态设置别名。例如为所有依赖使用工作区版本的 `lodash-es`：

```js title="lynx.config.ts"
import { createRequire } from 'node:module';

import { defineConfig } from '@lynx-js/rspeedy';

const require = createRequire(import.meta.url);

export default defineConfig({
  source: {
    alias: {
      'lodash-es': require.resolve('lodash-es'),
    },
  },
});
```

## 条件导出

[NodeJS 的条件导出](https://nodejs.org/api/packages.html#conditional-exports)机制支持根据特定条件映射到不同路径。

示例库的 `package.json` 包含如下导出配置时：

```json title="package.json"
{
  "name": "foo",
  "exports": {
    ".": {
      "lynx": "./index-lynx.js",
      "import": "./index-import.js",
      "require": "./index-require.js"
    },
    "./bar": {
      "import": "./bar-import.js",
      "lynx": "./bar-lynx.js",
      "require": "./bar-require.js"
    }
  }
}
```

导入行为：

- `foo` 将解析为 `foo/index-lynx.js`
- `foo/bar` 将解析为 `foo/bar-import.js`

:::info 注意条件顺序
exports 字段中的键序至关重要，较早出现的条件具有更高优先级。
:::

默认的 `resolve.conditionNames` 配置为：

```js title="rspack.config.js"
export default {
  resolve: {
    conditionNames: ['lynx', 'import', 'require', 'browser'],
  },
};
```

修改默认值可通过 [`tools.rspack`] 配置：

```js title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    rspack: {
      resolve: {
        conditionNames: ['...', 'foo'],
      },
    },
  },
});
```

## 主字段

当从 npm 包导入时，`mainFields` 选项决定了将检查其 `package.json` 中的哪些字段。

示例库的 `package.json` 包含如下配置时：

```json title="package.json"
{
  "name": "upstream",
  "lynx": "build/lynx.js",
  "module": "build/index.js"
}
```

执行 `import * as Upstream from 'upstream'` 将优先解析 `lynx` 字段指定的文件，因为该字段在 `mainFields` 配置中位列第一。

默认的 `resolve.mainFields` 配置为：

```js title="rspack.config.js"
export default {
  resolve: {
    mainFields: ['lynx', 'module', 'main'],
  },
};
```

修改默认值可通过 [`tools.rspack`] 配置：

```js title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    rspack: {
      resolve: {
        mainFields: ['...', 'foo'],
      },
    },
  },
});
```

## 主文件

当解析路径是目录时，解析器将尝试解析该目录的 `mainFiles` 配置项。

示例目录结构：

```
dir/
├─ sub/
│  ├─ index.js
├─ index.lynx.js
├─ index.js
```

导入行为：

- `dir/` 解析为 `dir/index.lynx.js`
- `dir/sub` 解析为 `dir/sub/index.js`

默认的 `resolve.mainFiles` 配置为：

```js title="rspack.config.js"
export default {
  resolve: {
    mainFiles: ['index.lynx', 'index'],
  },
};
```

修改默认值可通过 [`tools.rspack`] 配置：

```js title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    rspack: {
      resolve: {
        mainFiles: ['...', 'foo'],
      },
    },
  },
});
```

[`tools.rspack`]: ../../api/rspeedy.tools.rspack
