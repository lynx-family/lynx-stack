# Module Resolution

In modern front-end development, modularity has become a key approach to managing code effectively:

1. **Simplified Module Imports**:
   - Module resolution allows you to use concise and more readable paths for importing modules, instead of cumbersome relative paths. For example, with an alias configuration, you can use `@components/Button` instead of `../../../src/components/Button`, which significantly improves code maintainability.

2. **Environment-Aware Module Substitution**:
   - Module resolution enables you to load different versions of modules based on the environment (e.g., development and production or Lynx and browser). You can easily achieve environment-aware module substitution, ensuring that the most appropriate dependencies are used in different scenarios.

## Path Aliases

Path aliases allow developers to define aliases for modules, making it easier to reference them in code. This can be useful when you want to use a short, easy-to-remember name for a module instead of a long, complex path.

For example, if you frequently reference the `src/common/request.ts` module in your project, you can define an alias for it as `@request` and then use `import request from '@request'` in your code instead of writing the full relative path every time. This also allows you to move the module to a different location without needing to update all the import statements in your code.

### Using `tsconfig.json`'s `paths` Configuration

You can configure aliases through the `paths` configuration in `tsconfig.json`, which is the recommended approach in TypeScript projects as it also resolves the TS type issues related to path aliases.

For example:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["./src/common/*"]
    }
  }
}
```

After configuring, if you reference `@common/Foo.tsx` in your code, it will be mapped to the `<project>/src/common/Foo.tsx` path.

:::tip
You can refer to the [TypeScript - paths](https://typescriptlang.org/tsconfig#paths) documentation for more details.
:::

### Use `source.alias` Configuration

Rsbuild provides the [source.alias](/api/rspeedy.source.alias) configuration option, which corresponds to the webpack/Rspack native [resolve.alias](https://rspack.dev/config/resolve#resolvealias) configuration. You can configure this option using an object or a function.

#### Use Cases

The `paths` configuration in `tsconfig.json` is static and lacks dynamism. Furthermore, `paths` only takes effect when the module is included in [`source.include`](/api/rspeedy.source.include).

The `source.alias` configuration can overcome this limitation by enabling you to dynamically set `source.alias` using JavaScript code.

For example, use the workspace version of `lodash-es` for all dependencies:

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

## Conditional Exports

[NodeJS's conditional exports](https://nodejs.org/api/packages.html#conditional-exports) provide a way to map to different paths depending on certain conditions.

For example, consider an arbitrary library with a `package.json` that contains the following exports:

```json "package.json"
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

Importing:

- `foo` will resolve to `foo/index-lynx.js`
- `foo/bar` will resolve to `foo/bar-import.js`

:::info The key order in the exports field is significant
During condition matching, earlier entries have higher priority and take precedence over later entries.
:::

The default value of `resolve.conditionNames` is:

```js title="rspack.config.js"
export default {
  resolve: {
    conditionNames: ['lynx', 'import', 'require', 'browser'],
  },
};
```

To change the default value, use [`tools.rspack`]:

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

## Main Fields

When importing from an npm package, the `mainFields` option will determine which fields in its `package.json` are checked.

For example, consider an arbitrary library with a `package.json` that contains the following fields:

```json title="package.json"
{
  "name": "upstream",
  "lynx": "build/lynx.js",
  "module": "build/index.js"
}
```

When we `import * as Upstream from 'upstream'` this will actually resolve to the file in the `lynx` property. The `lynx` property takes precedence because it's the first item in `mainFields`.

The default value of `resolve.mainFields` is:

```js title="rspack.config.js"
export default {
  resolve: {
    mainFields: ['lynx', 'module', 'main'],
  },
};
```

To change the default value, use [`tools.rspack`]:

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

## Main Files

If the path to be resolved is an directory, the resolver will try to resolve the `mainFiles` of the directory.

For example, consider an directory with:

```
dir/
├─ sub/
│  ├─ index.js
├─ index.lynx.js
├─ index.js
```

Importing

- `dir/` will resolve to `dir/index.lynx.js`
- `dir/sub` will resolve to `dir/sub/index.js`

The default value of `resolve.mainFiles` is:

```js title="rspack.config.js"
export default {
  resolve: {
    mainFiles: ['index.lynx', 'index'],
  },
};
```

To change the default value, use [`tools.rspack`]:

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

[`tools.rspack`]: /api/rspeedy.tools.rspack
