# A2UI Catalog Extractor

`@lynx-js/a2ui-catalog-extractor` generates A2UI catalog schemas from explicit declaration syntax plus standard JSDoc, TSDoc, and TypeDoc metadata.

It is designed for the cases where checker-driven type extraction becomes brittle. The extractor reads the shapes that authors write directly in `.tsx`, keeps `.jsx` support as a best-effort path, and can emit either:

- legacy per-component shards such as `dist/catalog/Button/catalog.json`
- a full catalog object with `catalogId`, `components`, and optional root metadata passthrough

## What It Supports

The extractor reads:

- exported component function names as catalog component keys
- explicit TypeScript syntax for:
  - primitives
  - string literal unions
  - arrays
  - object literals and interfaces
  - optional properties
  - local aliases
  - `Record<string, T>` and string index signatures
  - unions such as `string | { path: string }`
- standard documentation tags for:
  - property `description`
  - `default`
  - `deprecated`
- named local interfaces and type aliases for complex nested object graphs
- `.jsx` best-effort typedef parsing through `@typedef`, `@property`, and parameter or property JSDoc type expressions

The legacy compatibility output covers the schema fields currently emitted by A2UI:

- `properties`
- `required`
- property `description`
- property `type`
- property `enum`
- property `oneOf`
- property `items`
- nested `properties`
- `additionalProperties`

## Authoring Model

Use `.tsx` as the primary authoring path.

```tsx
type Binding = { path: string };
type BindableText = string | Binding;

export interface TextProps {
  /** Literal text or a binding path. */
  text: BindableText;

  /**
   * Visual tone.
   * @defaultValue "body"
   */
  tone?: 'body' | 'caption';
}

export function Text(_props: TextProps): null {
  return null;
}
```

That produces a schema shaped like:

```json
{
  "Text": {
    "properties": {
      "text": {
        "description": "Literal text or a binding path.",
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": {
              "path": { "type": "string" }
            },
            "required": ["path"],
            "additionalProperties": false
          }
        ]
      },
      "tone": {
        "description": "Visual tone.",
        "type": "string",
        "enum": ["body", "caption"],
        "default": "body"
      }
    },
    "required": ["text"]
  }
}
```

## Standard Tags

Prefer standard tags first:

| Source                       | Generated field           |
| ---------------------------- | ------------------------- |
| summary text                 | `description`             |
| `@remarks`                   | appended to `description` |
| `@defaultValue` / `@default` | `default`                 |
| `@deprecated`                | `deprecated`              |
| string literal union         | `enum`                    |
| optional property            | omitted from `required`   |

For more complex schemas, keep the structure explicit in local types instead of relying on custom tags.

```ts
export interface ActionContextBinding {
  path: string;
}

export type ActionContextValue =
  | string
  | number
  | boolean
  | ActionContextBinding;

export interface ActionEvent {
  name: string;
  /** Context is a JSON object map in v0.9. */
  context?: Record<string, ActionContextValue>;
}

export interface ActionPayload {
  event: ActionEvent;
}

export interface ButtonProps {
  /** Host action payload. */
  action: ActionPayload;
}
```

See [references/tsdoc-mapping.md](./references/tsdoc-mapping.md) for the full mapping contract.

## CLI

Generate legacy shards:

```bash
a2ui-catalog-extractor generate \
  --source ./src/catalog \
  --out ./dist/catalog \
  --tsconfig ./tsconfig.json \
  --format legacy-shards
```

Check generated output:

```bash
a2ui-catalog-extractor check \
  --source ./src/catalog \
  --out ./dist/catalog \
  --tsconfig ./tsconfig.json \
  --format legacy-shards
```

Generate a full catalog object:

```bash
a2ui-catalog-extractor generate \
  --source ./src/catalog \
  --out ./dist/catalog \
  --tsconfig ./tsconfig.json \
  --format a2ui-catalog \
  --catalog-id demo-catalog \
  --title "Demo Catalog"
```

## API

```ts
import {
  extractCatalog,
  writeCatalogFiles,
} from '@lynx-js/a2ui-catalog-extractor';

const result = await extractCatalog({
  sourceDir: './src/catalog',
  tsconfigPath: './tsconfig.json',
  format: 'legacy-shards',
});

await writeCatalogFiles(result, {
  outDir: './dist/catalog',
});
```

## JSX Support

`.jsx` is best-effort in v1. Prefer a typedef block that fully describes the component props:

```jsx
/**
 * @typedef {object} BadgeProps
 * @property {string | { path: string }} text Literal badge text.
 * @property {'info' | 'warning'} [tone] Badge tone.
 */

/**
 * @param {BadgeProps} props
 */
export function Badge(props) {
  return props;
}
```

Complex nested schemas in `.jsx` should move to `.tsx` so the structure can stay explicit.

## A2UI Integration

The A2UI package uses this extractor during its build:

```bash
node --experimental-strip-types ../a2ui-catalog-extractor/src/cli.ts generate ...
```

This keeps the catalog build independent from a prebuilt extractor package while still preserving a normal ESM library and CLI build for direct package consumption.

## Validation

Run the focused package checks with Node 24 in this repository:

```bash
fnm exec --using v24.15.0 -- pnpm --filter @lynx-js/a2ui-catalog-extractor build
fnm exec --using v24.15.0 -- pnpm --filter @lynx-js/a2ui-catalog-extractor test
```

The test suite includes golden parity coverage for the current A2UI legacy catalog shards.
