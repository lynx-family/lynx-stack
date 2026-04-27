# A2UI Catalog Extractor

`@lynx-js/a2ui-catalog-extractor` generates A2UI component catalog JSON from TypeDoc project reflections.
Developers author catalog-facing TypeScript interfaces and comments; this package consumes TypeDoc reflection data and writes `catalog.json`.

The extractor does not parse TS/TSX source text, does not import the TypeScript compiler API, and does not ask developers to write JSON Schema.

## A2UI Catalog Shape

A2UI v0.9 catalogs describe the capabilities a renderer exposes to an agent:

- `catalogId`: stable catalog identifier used during catalog negotiation.
- `components`: component name to JSON Schema for runtime component props.
- `functions`: named functions with JSON Schema `parameters` and a scalar `returnType`.
- `theme`: theme property name to JSON Schema.

This package generates the `components` map and can wrap it with `catalogId`, `functions`, and `theme` through `createA2UICatalog`.

## Authoring Rules

Only TypeScript `interface` reflections are converted.
Mark the catalog-facing interface with the single custom tag:

```tsx
/**
 * @a2uiCatalog Text
 */
export interface TextProps {
  /** Literal text or path binding. */
  text: string | { path: string };
  variant?: 'h1' | 'h2' | 'body';
}
```

The generated schema is:

```json
{
  "Text": {
    "properties": {
      "text": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": { "path": { "type": "string" } },
            "required": ["path"],
            "additionalProperties": false
          }
        ],
        "description": "Literal text or path binding."
      },
      "variant": {
        "type": "string",
        "enum": ["h1", "h2", "body"]
      }
    },
    "required": ["text"]
  }
}
```

## Comment Mapping

Only `@a2uiCatalog` is custom.
All other metadata uses standard TypeDoc-supported tags:

- summary text maps to JSON Schema `description`.
- `@remarks` is appended to `description`.
- `@defaultValue` maps to JSON Schema `default`; JSON values are parsed when possible. Wrap object and array defaults in a code span, for example ``@defaultValue `{}```.
- `@deprecated` maps to JSON Schema `deprecated: true`.
- Optional properties are omitted from `required`.

## Type Mapping

The extractor generates schema from the TypeDoc type model:

- `string`, `number`, `boolean`
- string literal unions as `enum`
- other unions as `oneOf`
- `T[]`, `Array<T>`, `ReadonlyArray<T>`
- inline object type literals
- `Record<string, T>`

Unsupported references and ambiguous catalog-facing types such as `any`, `unknown`, `never`, `void`, and nullable unions fail with an actionable error.
Inline the catalog-facing shape in the marked interface instead of relying on imported type aliases.

## CLI

Run TypeDoc conversion and write one file per component:

```bash
a2ui-catalog-extractor --catalog-dir src/catalog --out-dir dist/catalog
```

Use an existing TypeDoc JSON project:

```bash
a2ui-catalog-extractor --typedoc-json typedoc.json --out-dir dist/catalog
```

## API

```ts
import {
  createA2UICatalog,
  extractCatalogComponents,
  extractCatalogComponentsFromTypeDocJson,
  writeComponentCatalogs,
} from '@lynx-js/a2ui-catalog-extractor';

const components = await extractCatalogComponents({
  sourceFiles: ['src/catalog/Text/index.tsx'],
});

const catalog = createA2UICatalog({
  catalogId: 'https://example.com/catalogs/basic/v1/catalog.json',
  components,
});

await writeComponentCatalogs({
  sourceFiles: ['src/catalog/Text/index.tsx'],
  outDir: 'dist/catalog',
});

const componentsFromJson = extractCatalogComponentsFromTypeDocJson(projectJson);
```

## References

- [A2UI Catalogs](https://a2ui.org/concepts/catalogs/)
- [A2UI v0.9 protocol](https://a2ui.org/specification/v0.9-a2ui/)
- [TypeDoc custom tags](https://typedoc.org/documents/Tags.html)
- [TypeDoc JSON output](https://typedoc.org/documents/Options.Output.html)
