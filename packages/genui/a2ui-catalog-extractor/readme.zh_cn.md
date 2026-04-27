# A2UI Catalog Extractor

[English](./README.md) | 简体中文

`@lynx-js/a2ui-catalog-extractor` 会把 TypeScript 组件接口转换成 A2UI
组件 catalog JSON。你只需要用 TypeScript `interface` 写一次组件的公开
契约，用普通 TypeDoc 注释描述字段，然后让这个包生成 A2UI agent 可以读取的
JSON Schema。

这个包目前在 Lynx Stack monorepo 中仍然是 `private`。下面的 npm 安装示例
描述的是包发布后的用法。如果你正在本仓库里开发，请使用
[在本 Monorepo 中使用](#在本-monorepo-中使用) 里的 workspace 命令。

## 它解决什么问题

A2UI catalog 用来描述 renderer 支持哪些组件。对每个组件，catalog 会告诉
agent 哪些 props 合法、哪些 props 必填、哪些 enum 值可用，以及每个字段的
含义。

这个 extractor 生成 A2UI v0.9 catalog 中的 `components` 部分：

```json
{
  "QuickStartCard": {
    "properties": {
      "title": { "type": "string" }
    },
    "required": ["title"]
  }
}
```

它也可以通过 `createA2UICatalog` 把生成的 components 包装进带
`catalogId`、`functions` 和 `theme` 的完整 catalog 对象。

## 它不做什么

- 它不渲染 A2UI UI。
- 它不手写解析 TypeScript 源码文本。
- 它不直接使用 TypeScript compiler API。
- 它不要求你在注释里写 JSON Schema。
- 它不会展开任意导入的 type alias 或外部 interface。

这个包消费 TypeDoc reflection 数据。这样实现更小，但也意味着面向 catalog
的类型形状应该直接内联写在被标记的 interface 中。

## 环境要求

- Node.js 22 或更新版本。
- TypeDoc 可以读取的 TypeScript 或 TSX 源文件。
- 每个 catalog 组件契约使用一个 TypeScript `interface`。

## 安装

### 已发布的 npm 包

包发布后，把它安装为开发依赖：

```bash
pnpm add -D @lynx-js/a2ui-catalog-extractor
```

然后在你的 package 中加入脚本：

```json
{
  "scripts": {
    "build:catalog": "a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog"
  }
}
```

运行：

```bash
pnpm build:catalog
```

### 在本 Monorepo 中使用

`@lynx-js/a2ui-reactlynx` 已经接入了这个工具：

```bash
pnpm -C packages/genui/a2ui build
```

这个命令实际会运行：

```bash
a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog
```

如果要开发 extractor 本身：

```bash
pnpm -C packages/genui/a2ui-catalog-extractor test
```

如果依赖缺失，先在仓库根目录安装依赖：

```bash
pnpm install --frozen-lockfile
```

## 快速开始

这个示例对应测试夹具 `test/fixtures/catalog/QuickStartCard.tsx`。

### 1. 创建面向 catalog 的 interface

创建 `src/catalog/QuickStartCard.tsx`：

```tsx
/**
 * Quick start card fixture.
 *
 * @remarks This fixture mirrors the README quick start.
 * @a2uiCatalog QuickStartCard
 */
export interface QuickStartCardProps {
  /** Card title text or data binding. */
  title: string | { path: string };
  /** Visual tone used by the renderer. */
  tone?: 'neutral' | 'accent';
  /**
   * Tags shown below the title.
   *
   * @defaultValue `[]`
   */
  tags?: string[];
  /** Author metadata rendered in the card footer. */
  author: {
    /** Display name. */
    name: string;
    /** Optional profile URL. */
    url?: string;
  };
  /**
   * Extra analytics context sent with user actions.
   *
   * @defaultValue `{}`
   */
  context?: Record<string, string | number | boolean>;
}
```

最关键的是 `@a2uiCatalog QuickStartCard`。它告诉 extractor：这个 interface
应该生成名为 `QuickStartCard` 的 catalog 组件。

### 2. 生成 catalog 文件

运行：

```bash
a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog
```

extractor 会扫描 catalog 目录，找到带 `@a2uiCatalog` 的 interface，并为每个
组件写出一个文件：

```text
dist/catalog/
  QuickStartCard/
    catalog.json
```

### 3. 查看生成的 schema

`dist/catalog/QuickStartCard/catalog.json` 会类似下面这样：

```json
{
  "QuickStartCard": {
    "properties": {
      "title": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "type": "object",
            "properties": {
              "path": {
                "type": "string"
              }
            },
            "required": [
              "path"
            ],
            "additionalProperties": false
          }
        ],
        "description": "Card title text or data binding."
      },
      "tone": {
        "type": "string",
        "enum": [
          "neutral",
          "accent"
        ],
        "description": "Visual tone used by the renderer."
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Tags shown below the title.",
        "default": []
      },
      "author": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Display name."
          },
          "url": {
            "type": "string",
            "description": "Optional profile URL."
          }
        },
        "required": [
          "name"
        ],
        "additionalProperties": false,
        "description": "Author metadata rendered in the card footer."
      },
      "context": {
        "type": "object",
        "additionalProperties": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            },
            {
              "type": "boolean"
            }
          ]
        },
        "description": "Extra analytics context sent with user actions.",
        "default": {}
      }
    },
    "required": [
      "title",
      "author"
    ],
    "description": "Quick start card fixture.\n\nThis fixture mirrors the README quick start."
  }
}
```

注意这些转换：

- `title` 没有 `?`，所以是必填。
- `tone` 变成字符串 enum。
- `tags?: string[]` 变成可选的字符串数组。
- `author` 变成严格的内联对象，并带有 `additionalProperties: false`。
- `context?: Record<string, string | number | boolean>` 变成 object map，并用
  `additionalProperties` 描述值类型。
- TypeDoc 注释变成 JSON Schema description。

## 编写规则

### 只标记 catalog 契约

只有 TypeScript `interface` reflection 会被转换。把 `@a2uiCatalog` 放在
agent 被允许发送的 props interface 上：

```tsx
/**
 * @a2uiCatalog Text
 */
export interface TextProps {
  text: string;
}
```

不要把 tag 放在组件函数上：

```tsx
export function Text(_props: TextProps) {
  return null;
}
```

### 组件名

你可以显式写组件名：

```tsx
/**
 * @a2uiCatalog Text
 */
export interface TextProps {}
```

如果 tag 内容为空，extractor 会从 interface 名推断组件名，规则是去掉结尾的
`Props` 或 `ComponentProps`：

```tsx
/**
 * @a2uiCatalog
 */
export interface DemoTextProps {}
```

这会生成 `DemoText`。

### 注释会变成 schema 元数据

使用普通 TypeDoc 注释：

```tsx
/**
 * User-facing card.
 *
 * @remarks Use this for compact summaries.
 * @a2uiCatalog SummaryCard
 */
export interface SummaryCardProps {
  /**
   * Optional display density.
   *
   * @defaultValue `"comfortable"`
   */
  density?: 'compact' | 'comfortable';
}
```

extractor 的映射规则如下：

| TypeDoc 注释                  | JSON Schema 输出     |
| ----------------------------- | -------------------- |
| summary 文本                  | `description`        |
| `@remarks`                    | 追加到 `description` |
| `@defaultValue` 或 `@default` | `default`            |
| `@deprecated`                 | `deprecated: true`   |
| 可选属性 `?`                  | 不放入 `required`    |

对象和数组默认值建议把 JSON 放在 code span 里：

```tsx
/**
 * @defaultValue `{}`
 */
context?: Record<string, string>;
```

如果不用 code span，TypeDoc 可能传入格式化后的文本，而不是原始 JSON 值。

### 支持的 TypeScript 形状

| TypeScript 形状              | JSON Schema 形状                             |
| ---------------------------- | -------------------------------------------- |
| `string`                     | `{ "type": "string" }`                       |
| `number`                     | `{ "type": "number" }`                       |
| `boolean`                    | `{ "type": "boolean" }`                      |
| `'a' \| 'b'`                 | `{ "type": "string", "enum": ["a", "b"] }`   |
| `string \| { path: string }` | `{ "oneOf": [...] }`                         |
| `T[]`                        | `{ "type": "array", "items": ... }`          |
| `Array<T>`                   | `{ "type": "array", "items": ... }`          |
| `ReadonlyArray<T>`           | `{ "type": "array", "items": ... }`          |
| `{ name: string }`           | 带 `additionalProperties: false` 的严格对象  |
| `Record<string, T>`          | 带 `additionalProperties: ...` 的 object map |

### 不支持或含义不明确的类型

这些类型会故意报错：

- `any`
- `unknown`
- `null`
- `undefined`
- `never`
- `void`
- `string | null` 这样的 nullable union
- 大多数导入的 alias 和被引用的外部 interface
- `Record<number, T>` 或其他非 string record key

建议写明确的 catalog 契约：

```tsx
// 不建议在 catalog-facing interface 中这样写。
type ExternalCardData = {
  title: string;
};

export interface CardProps {
  data: ExternalCardData;
}
```

改成内联形状：

```tsx
export interface CardProps {
  data: {
    title: string;
  };
}
```

## CLI 参考

```bash
a2ui-catalog-extractor [options]
```

| 选项                    | 说明                                                           | 默认值         |
| ----------------------- | -------------------------------------------------------------- | -------------- |
| `--catalog-dir <dir>`   | 要扫描的源码目录。可重复。                                     | `src/catalog`  |
| `--source <path>`       | 要扫描的源码文件或目录。可重复。                               | 无             |
| `--typedoc-json <file>` | 读取已有 TypeDoc JSON project，不重新运行 TypeDoc conversion。 | 无             |
| `--out-dir <dir>`       | 写出组件 catalog 文件的目录。                                  | `dist/catalog` |
| `--version`, `-v`       | 打印包版本。                                                   | 无             |
| `--help`, `-h`          | 打印用法。                                                     | 无             |

`--source` 和 `--catalog-dir` 可以一起使用。extractor 会合并全部输入、去重、
排序，然后运行 TypeDoc。

扫描器接受 `.ts`、`.tsx`、`.js`、`.jsx`、`.mts` 和 `.cts` 文件。它会忽略
`.d.ts`、`node_modules`、`dist` 和 `.turbo`。

## 编程 API

### 从源码文件生成 components

```ts
import {
  extractCatalogComponents,
  writeComponentCatalogs,
} from '@lynx-js/a2ui-catalog-extractor';

const components = await extractCatalogComponents({
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
});

await writeComponentCatalogs({
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
  outDir: 'dist/catalog',
});
```

如果路径需要相对某个项目目录解析，使用 `cwd`：

```ts
await writeComponentCatalogs({
  cwd: process.cwd(),
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
  outDir: 'dist/catalog',
});
```

如果项目需要指定 TypeScript 配置，使用 `tsconfig`：

```ts
const components = await extractCatalogComponents({
  cwd: process.cwd(),
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
  tsconfig: 'tsconfig.json',
});
```

### 从 TypeDoc JSON 生成 components

如果你的构建流程已经生成 TypeDoc JSON project，可以直接复用：

```ts
import * as fs from 'node:fs';

import {
  extractCatalogComponentsFromTypeDocJson,
  writeCatalogComponents,
} from '@lynx-js/a2ui-catalog-extractor';

const projectJson = JSON.parse(
  await fs.promises.readFile('typedoc.json', 'utf8'),
);
const components = extractCatalogComponentsFromTypeDocJson(projectJson);

writeCatalogComponents(components, {
  outDir: 'dist/catalog',
});
```

等价的 CLI 命令是：

```bash
a2ui-catalog-extractor --typedoc-json typedoc.json --out-dir dist/catalog
```

### 创建完整 A2UI catalog 对象

`createA2UICatalog` 是一个小 helper，用来把生成的 components 包装进其他
A2UI catalog 顶层字段：

```ts
import {
  createA2UICatalog,
  extractCatalogComponents,
} from '@lynx-js/a2ui-catalog-extractor';

const components = await extractCatalogComponents({
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
});

const catalog = createA2UICatalog({
  catalogId: 'https://example.com/catalogs/basic/v1/catalog.json',
  components,
  functions: [
    {
      name: 'formatDisplayValue',
      description: 'Format a raw value for display.',
      parameters: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
        additionalProperties: false,
      },
      returnType: 'string',
    },
  ],
  theme: {
    accentColor: { type: 'string' },
  },
});
```

`functions` 和 `theme` 不会从 TypeScript 自动提取。如果 catalog 需要这些
字段，请显式传入。

## 故障排查和 FAQ

### `Unsupported ambiguous intrinsic TypeDoc type "unknown"`

catalog 需要明确 schema。把 `unknown` 或 `any` 改成具体类型：

```tsx
// 会失败。
payload: unknown;

// 可以工作。
payload: {
  id: string;
  count: number;
}
```

### `Unsupported nullable union`

nullable union 不被接受：

```tsx
// 会失败。
label: string | null;
```

如果字段可以省略，把它设为可选：

```tsx
label?: string;
```

或者显式建模状态：

```tsx
label: string | { path: string };
```

### `Unsupported TypeDoc reference`

extractor 只理解少量 reference：`Array<T>`、`ReadonlyArray<T>` 和
`Record<string, T>`。请在 catalog-facing interface 中内联对象形状，不要导入
alias。

### 输出目录为空

检查这些点：

- 被扫描文件里有 `interface`，而不只是 `type`。
- interface 带有 `@a2uiCatalog`。
- 传给 `--catalog-dir` 或 `--source` 的路径存在。
- 文件不是 `.d.ts`。
- TypeDoc 可以用你的 `tsconfig` 解析这些文件。

### 生成的 schema 为什么没有继承来的 props

继承成员会被跳过。这是有意设计，因为 renderer context 这类运行时字段不应该
成为 agent-facing catalog 的一部分。请把所有面向 catalog 的 props 直接写在被
标记的 interface 上。

### 我应该手写 JSON Schema 吗

不应该。请把契约保留在 TypeScript 和注释里。手写 schema 很容易和组件 props
漂移，而这个包会让 catalog 成为可重复生成的构建产物。

### 这能替代 TypeScript 类型检查吗

不能。TypeDoc conversion 只是用来读取 reflection 数据，不是用来验证完整应用。
请继续运行正常的 TypeScript、lint 和测试命令。

## 开发备注

这个包 README 中的 quick-start 示例有测试覆盖。修改示例时，请同时更新 fixture
和 expected catalog JSON。

常用本地检查：

```bash
pnpm -C packages/genui/a2ui-catalog-extractor test
pnpm dprint fmt -- packages/genui/a2ui-catalog-extractor/README.md packages/genui/a2ui-catalog-extractor/readme.zh_cn.md packages/genui/a2ui-catalog-extractor/AGENTS.md packages/genui/a2ui-catalog-extractor/test/extractor.test.ts
```

## 参考资料

- [A2UI Catalogs](https://a2ui.org/concepts/catalogs/)
- [A2UI v0.9 protocol](https://a2ui.org/specification/v0.9-a2ui/)
- [TypeDoc custom tags](https://typedoc.org/documents/Tags.html)
- [TypeDoc JSON output](https://typedoc.org/documents/Options.Output.html)
