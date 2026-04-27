# A2UI Catalog Extractor

English | [简体中文](./readme.zh_cn.md)

`@lynx-js/a2ui-catalog-extractor` turns TypeScript component
interfaces into A2UI component catalog JSON. You write the public
component contract once as a TypeScript `interface`, describe it with
normal TypeDoc comments, and let this package generate the JSON Schema
that an A2UI agent can read.

## What It Does

A2UI catalogs describe what components a renderer supports. For each
component, the catalog tells an agent which props are valid, which props
are required, which enum values are allowed, and what each field means.

This extractor generates the `components` part of an A2UI v0.9 catalog:

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

It can also wrap those generated components with a `catalogId`,
`functions`, and `theme` through `createA2UICatalog`.

## What It Does Not Do

- It does not render A2UI UI.
- It does not parse TypeScript source text by hand.
- It does not use the TypeScript compiler API directly.
- It does not ask you to write JSON Schema in comments.
- It does not expand arbitrary imported type aliases or external
  interfaces.

The package consumes TypeDoc reflection data. This keeps the implementation
small, but it also means catalog-facing shapes should be written inline in
the marked interface.

## Requirements

- Node.js 22 or newer.
- TypeScript or TSX source files that TypeDoc can read.
- One TypeScript `interface` per catalog-facing component contract.

## Installation

### Package manager

Install it as a development dependency:

```bash
pnpm add -D @lynx-js/a2ui-catalog-extractor
```

Then add a script to your package:

```json
{
  "scripts": {
    "build:catalog": "a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog"
  }
}
```

Run it with:

```bash
pnpm build:catalog
```

## Quick Start

This example walks through a complete component contract from TypeScript
interface to generated catalog JSON.

### 1. Create a catalog-facing interface

Create `src/catalog/QuickStartCard.tsx`:

```tsx
/**
 * Quick start card.
 *
 * @remarks Use this contract as a compact card example.
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

The important part is `@a2uiCatalog QuickStartCard`. It tells the
extractor that this interface should become a catalog component named
`QuickStartCard`.

### 2. Generate catalog files

Run:

```bash
a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog
```

The extractor scans the catalog directory, finds interfaces marked with
`@a2uiCatalog`, and writes one file per component:

```text
dist/catalog/
  QuickStartCard/
    catalog.json
```

### 3. Read the generated schema

`dist/catalog/QuickStartCard/catalog.json` will look like this:

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
    "description": "Quick start card.\n\nUse this contract as a compact card example."
  }
}
```

Notice the main conversions:

- `title` is required because it does not use `?`.
- `tone` becomes a string enum.
- `tags?: string[]` becomes an optional array of strings.
- `author` becomes a strict inline object with
  `additionalProperties: false`.
- `context?: Record<string, string | number | boolean>` becomes an object
  map with `additionalProperties`.
- TypeDoc comments become JSON Schema descriptions.

## Authoring Guide

### Mark only the catalog contract

Only TypeScript `interface` reflections are converted. Put
`@a2uiCatalog` on the interface that describes the props an agent is
allowed to send:

```tsx
/**
 * @a2uiCatalog Text
 */
export interface TextProps {
  text: string;
}
```

Do not put the tag on the component function:

```tsx
export function Text(_props: TextProps) {
  return null;
}
```

### Component names

You can write the component name explicitly:

```tsx
/**
 * @a2uiCatalog Text
 */
export interface TextProps {}
```

If the tag is empty, the extractor infers the name from the interface by
removing a trailing `Props` or `ComponentProps`:

```tsx
/**
 * @a2uiCatalog
 */
export interface DemoTextProps {}
```

This becomes `DemoText`.

### Comments become schema metadata

Use normal TypeDoc comments:

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

The extractor maps comments like this:

| TypeDoc comment               | JSON Schema output               |
| ----------------------------- | -------------------------------- |
| Summary text                  | `description`                    |
| `@remarks`                    | Appended to `description`        |
| `@defaultValue` or `@default` | `default`                        |
| `@deprecated`                 | `deprecated: true`               |
| Optional property `?`         | Property omitted from `required` |

For object and array defaults, put JSON inside a code span:

```tsx
/**
 * @defaultValue `{}`
 */
context?: Record<string, string>;
```

Without the code span, TypeDoc may pass formatted text instead of the raw
JSON value.

### Supported TypeScript shapes

| TypeScript shape             | JSON Schema shape                                |
| ---------------------------- | ------------------------------------------------ |
| `string`                     | `{ "type": "string" }`                           |
| `number`                     | `{ "type": "number" }`                           |
| `boolean`                    | `{ "type": "boolean" }`                          |
| `'a' \| 'b'`                 | `{ "type": "string", "enum": ["a", "b"] }`       |
| `string \| { path: string }` | `{ "oneOf": [...] }`                             |
| `T[]`                        | `{ "type": "array", "items": ... }`              |
| `Array<T>`                   | `{ "type": "array", "items": ... }`              |
| `ReadonlyArray<T>`           | `{ "type": "array", "items": ... }`              |
| `{ name: string }`           | Strict object with `additionalProperties: false` |
| `Record<string, T>`          | Object map with `additionalProperties: ...`      |

### Unsupported or ambiguous types

These types intentionally fail:

- `any`
- `unknown`
- `null`
- `undefined`
- `never`
- `void`
- nullable unions such as `string | null`
- most imported aliases and referenced external interfaces
- `Record<number, T>` or other non-string record keys

Prefer explicit catalog contracts:

```tsx
// Avoid this in catalog-facing interfaces.
type ExternalCardData = {
  title: string;
};

export interface CardProps {
  data: ExternalCardData;
}
```

Write the shape inline instead:

```tsx
export interface CardProps {
  data: {
    title: string;
  };
}
```

## CLI Reference

```bash
a2ui-catalog-extractor [options]
```

| Option                  | Description                                                                  | Default        |
| ----------------------- | ---------------------------------------------------------------------------- | -------------- |
| `--catalog-dir <dir>`   | Directory to scan for source files. Repeatable.                              | `src/catalog`  |
| `--source <path>`       | Source file or directory to scan. Repeatable.                                | None           |
| `--typedoc-json <file>` | Read an existing TypeDoc JSON project instead of running TypeDoc conversion. | None           |
| `--out-dir <dir>`       | Directory where component catalog files are written.                         | `dist/catalog` |
| `--version`, `-v`       | Print the package version.                                                   | None           |
| `--help`, `-h`          | Print usage.                                                                 | None           |

`--source` and `--catalog-dir` can be used together. The extractor merges
all inputs, removes duplicates, sorts them, and then runs TypeDoc.

The scanner accepts `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, and `.cts`
files. It ignores `.d.ts`, `node_modules`, `dist`, and `.turbo`.

## Programmatic API

### Generate components from source files

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

Use `cwd` when paths should be resolved relative to a specific project
directory:

```ts
await writeComponentCatalogs({
  cwd: process.cwd(),
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
  outDir: 'dist/catalog',
});
```

Use `tsconfig` when the project needs a specific TypeScript config:

```ts
const components = await extractCatalogComponents({
  cwd: process.cwd(),
  sourceFiles: ['src/catalog/QuickStartCard.tsx'],
  tsconfig: 'tsconfig.json',
});
```

### Generate components from TypeDoc JSON

If your build already produces a TypeDoc JSON project, reuse it:

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

The equivalent CLI command is:

```bash
a2ui-catalog-extractor --typedoc-json typedoc.json --out-dir dist/catalog
```

### Create a full A2UI catalog object

`createA2UICatalog` is a small helper that wraps generated components with
the other top-level A2UI catalog fields:

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

`functions` and `theme` are not extracted from TypeScript. Pass them
explicitly if your catalog needs them.

## Troubleshooting

### `Unsupported ambiguous intrinsic TypeDoc type "unknown"`

The catalog needs a concrete schema. Replace `unknown` or `any` with a
specific type:

```tsx
// Fails.
payload: unknown;

// Works.
payload: {
  id: string;
  count: number;
}
```

### `Unsupported nullable union`

Nullable unions are not accepted:

```tsx
// Fails.
label: string | null;
```

Make the property optional if it can be omitted:

```tsx
label?: string;
```

Or model the state explicitly:

```tsx
label: string | { path: string };
```

### `Unsupported TypeDoc reference`

The extractor only understands a small set of references:
`Array<T>`, `ReadonlyArray<T>`, and `Record<string, T>`. Inline object
shapes in the catalog-facing interface instead of importing aliases.

### My output directory is empty

Check these points:

- The scanned files contain an `interface`, not only a `type`.
- The interface has `@a2uiCatalog`.
- The path passed to `--catalog-dir` or `--source` exists.
- The files are not `.d.ts`.
- TypeDoc can parse the files with your `tsconfig`.

### The generated schema does not include inherited props

Inherited members are skipped. This is intentional because runtime-only
props such as renderer context should not be part of the agent-facing
catalog. Put every catalog-facing prop directly on the marked interface.

### Should I hand-write JSON Schema instead?

No. Keep the contract in TypeScript and comments. Hand-written schema tends
to drift away from component props, while this package makes the catalog a
repeatable build artifact.

### Does this replace TypeScript type checking?

No. TypeDoc conversion is used to read reflection data, not to validate
your full application. Continue running your normal TypeScript, lint, and
test commands.

## References

- [A2UI Catalogs](https://a2ui.org/concepts/catalogs/)
- [A2UI v0.9 protocol](https://a2ui.org/specification/v0.9-a2ui/)
- [TypeDoc custom tags](https://typedoc.org/documents/Tags.html)
- [TypeDoc JSON output](https://typedoc.org/documents/Options.Output.html)
