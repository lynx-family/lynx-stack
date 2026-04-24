# A2UI v0.9 Catalog Surface

This note summarizes the A2UI v0.9 catalog concepts that matter for the extractor.

## Root Catalog Fields

The reusable full-catalog API currently accepts and emits these root fields:

- `$schema`: optional schema identifier for the catalog document
- `catalogId`: stable identifier for the catalog
- `title`: human-readable catalog title
- `description`: human-readable catalog description
- `components`: component schemas keyed by component name
- `functions`: optional function schemas exposed to the catalog runtime
- `theme`: optional theme-related schema metadata

This is currently a root-level metadata wrapper around extracted component schemas. It does not yet synthesize richer v0.9-only structures beyond the extracted `components` map and explicit caller-provided root metadata.

The A2UI package currently builds in legacy shard mode, where each generated file only contains the component map for one component:

```json
{
  "Button": {
    "properties": {},
    "required": []
  }
}
```

## Component Schema Fields

For current A2UI compatibility, the extractor must preserve these fields:

- `properties`
- `required`
- property `description`
- property `type`
- property `enum`
- property `oneOf`
- property `items`
- nested `properties`
- `additionalProperties`

## How Schema Fields Reflect A2UI Capabilities

### Binding-capable values

A2UI commonly models data binding as a literal value or a path object. In schema form that becomes a `oneOf` branch such as:

- literal `string`, `number`, or `boolean`
- binding object `{ path: string }`

This is how props such as text content, URLs, or form values describe runtime data binding.

### Child and template references

Container-like components often accept child component identifiers, arrays of child identifiers, or template-like objects. These shapes are represented with:

- `type: "string"`
- `type: "array"` plus `items`
- nested object `properties`
- `oneOf` when static and dynamic child forms coexist

### Actions

Interactive components describe host action payloads as nested objects with required fields and constrained maps. These rely on:

- nested `properties`
- nested `required`
- `additionalProperties`
- `oneOf` for mixed scalar-or-binding map values

### Layout controls

Layout containers such as `Row`, `Column`, and `List` mostly use:

- string `enum` for direction, alignment, and justification
- scalar properties for sizing, gap, padding, and weights

### Form values

Form-like inputs often use:

- scalar value types
- binding unions through `oneOf`
- defaults and descriptions from standard tags

## Compatibility Target

The compatibility target for this repository is the existing A2UI legacy shard output in `packages/genui/a2ui/dist/catalog/*/catalog.json`.

When changing extraction behavior:

1. preserve the existing shard contract unless the task explicitly changes it
2. update or add golden fixtures in `packages/genui/a2ui-catalog-extractor/test/fixtures/legacy-baseline`
3. verify the A2UI package build still regenerates the expected catalog files
