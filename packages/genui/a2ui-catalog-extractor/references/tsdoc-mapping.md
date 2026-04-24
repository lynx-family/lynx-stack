# TSDoc and TypeDoc Mapping

This package uses TypeDoc as the documentation front-end and explicit TypeScript syntax as the schema front-end.

## Preferred Inputs

Use these sources in order of preference:

1. explicit `.tsx` type declarations
2. standard JSDoc, TSDoc, and TypeDoc tags
3. `.jsx` typedef blocks
4. `@a2uiSchema` as the escape hatch

## Standard Mapping

| Authoring input                               | Generated schema                             |
| --------------------------------------------- | -------------------------------------------- |
| exported function name                        | catalog component key                        |
| property summary text                         | `description`                                |
| `@remarks`                                    | appended to `description`                    |
| `@defaultValue` / `@default`                  | `default`                                    |
| `@deprecated`                                 | `deprecated: true`                           |
| optional property                             | omitted from `required`                      |
| string literal union                          | `type: "string"` plus `enum`                 |
| `T[]` or `Array<T>`                           | `type: "array"` plus `items`                 |
| `Record<string, T>` or string index signature | `type: "object"` plus `additionalProperties` |
| `A                                            | B`                                           |

## Supported Explicit Type Shapes

The extractor intentionally stays checker-free. It supports:

- primitives
- string literal unions
- arrays
- object type literals
- interfaces
- local type aliases
- optional properties
- string-indexed maps
- unions such as `string | { path: string }`

The extractor does not depend on full type resolution across complex generic graphs. If a schema must be more precise than the local syntax can express, use `@a2uiSchema`.

## JSX Best-Effort Rules

`.jsx` support is based on JSDoc typedef parsing.

Recommended pattern:

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

Use `.tsx` for reliable parity when a component has nested unions, index signatures, or complex object graphs.

## `@a2uiSchema`

`@a2uiSchema` attaches a strict JSON Schema fragment to the current property node.

Allowed top-level keys:

- `additionalProperties`
- `const`
- `default`
- `deprecated`
- `description`
- `enum`
- `items`
- `oneOf`
- `properties`
- `required`
- `type`

Validation rules:

- the tag body must be valid JSON
- the body must be an object fragment, not an array or primitive
- root schema identity keys are rejected
- prototype-polluting keys are rejected

Merge rules:

- the inferred schema is built first
- object fields are merged recursively
- non-object values replace the inferred value

Example:

```ts
/**
 * Host action payload.
 * @a2uiSchema {
 *   "type": "object",
 *   "properties": {
 *     "event": {
 *       "type": "object",
 *       "properties": {
 *         "name": { "type": "string" }
 *       },
 *       "required": ["name"],
 *       "additionalProperties": false
 *     }
 *   },
 *   "required": ["event"],
 *   "additionalProperties": false
 * }
 */
action: unknown;
```

Use this sparingly. If explicit syntax plus standard tags can describe the shape, prefer that path.

## A2UI-Specific Notes

- Framework-only props are filtered out by name.
- Legacy shard mode emits `{ [ComponentName]: ComponentSchema }`.
- Full catalog mode emits a catalog object with `components` and optional root metadata supplied through the extractor options.
- Custom block tag payloads are parsed from the TypeScript AST because current TypeDoc output does not preserve custom block tag bodies for this use case.
