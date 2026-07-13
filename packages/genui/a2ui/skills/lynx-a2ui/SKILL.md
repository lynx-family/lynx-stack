---
name: lynx-a2ui
description: Convert natural-language UI requests into A2UI v0.9 JSON protocol messages that an A2UI renderer can consume.
---

# A2UI Generator

Use this skill when an agent must turn a natural-language request into A2UI
protocol data for rendering. The output is data only: a JSON array of A2UI v0.9
messages.

## Generation Workflow

1. Fetch the latest catalog from the URL in the Catalog Source section.
2. Read `catalogId`, component schemas, function schemas, required fields, enum
   values, and examples if the fetched catalog provides them.
3. Build the UI from the protocol rules, catalog schema, hard rules, and
   example patterns embedded in this skill.
4. Translate the user's intent into a data model and a flat component graph that
   validates against the latest fetched catalog.
5. Emit only the final JSON array of A2UI messages.

This skill is self-contained for third-party agent platforms. Do not rely on
repository-local files.

## Protocol Reference

A2UI is a JSON-based streaming UI protocol. The agent describes an interface by
emitting declarative JSON messages. The renderer instantiates only trusted
components from the active catalog. There is no arbitrary code: never emit
JavaScript, HTML, CSS, event handlers, scripts, or executable snippets.

Design principles:

- Prompt-first: follow the in-context schema and examples exactly.
- Safe like data, expressive like code: emit trusted component data only.
- Structure/data separation: component messages define a flat UI graph; data
  model messages populate or update values used by dynamic bindings.
- Progressive rendering: each valid message may be rendered as it arrives.
  Prefer a useful minimal UI first, then add data or refinements.
- Transport-agnostic: A2UI messages may travel over SSE, REST, WebSocket, A2A,
  AG UI, MCP, or another host transport.

Envelope semantics:

- `createSurface` creates a surface. Once created, its `surfaceId` and
  `catalogId` are fixed. To change catalog or theme, delete and recreate the
  surface.
- `updateDataModel` sets values inside a surface's data model. It has shape
  `{ "surfaceId": string, "path"?: string, "value"?: any }`. `path` defaults
  to `/`, and `value` may be any JSON value.
- `updateComponents` adds or replaces component definitions for a surface. It
  may reference data paths, but those paths should already be populated by an
  earlier `updateDataModel` message in the same response.
- `deleteSurface` removes a surface.

## Output Contract

Return only a **pretty**-printed JSON array. Do not return Markdown, prose, XML,
HTML, JavaScript, CSS, code fences, comments, or trailing commas.

Each array item must be a top-level object with `"version": "v0.9"` and exactly
one of these message keys:

- `"createSurface"`: create a new render surface.
- `"updateDataModel"`: set JSON values used by bindings.
- `"updateComponents"`: add or replace component definitions.
- `"deleteSurface"`: remove an existing surface.

For a fresh UI response, emit messages in this order:

1. `createSurface`
2. `updateDataModel` for any initial values read through `{ "path": ... }`
3. `updateComponents` containing a component with id `"root"`
4. optional additional `updateDataModel` or `updateComponents` messages

The first fresh `updateComponents` message should contain exactly one `root`
component. Later `updateComponents` messages may replace or add more components
as needed. Put each message object and component object on separate lines so the
JSON remains easy to parse and validate.

Before finishing, check bracket balance: every component object closes once,
every `components` array closes once, every message object closes once, and the
outer array closes exactly once.

## Catalog Source

Use surface id `"main"` unless the caller provides a different id. Before
generating A2UI JSON, fetch the latest Lynx GenUI A2UI catalog from:

```json
"https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json"
```

Treat that fetched catalog as the authoritative, dynamic type definition for
the generated UI. Do not rely on a stale component list remembered from this
skill. The catalog has this top-level structure:

```json
{
  "catalogId": "https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json",
  "components": {},
  "functions": {}
}
```

Use the fetched `catalogId` value in `createSurface.catalogId`. Use only
components listed under `components`, only functions listed under `functions`,
and only props, required fields, enum values, dynamic value shapes, and action
schemas allowed by that latest catalog. If the catalog cannot be fetched, ask
for the catalog content or a reachable catalog URL before generating non-trivial
UI.

If the user supplies a different catalog URL or catalog JSON, use that catalog
instead of the default URL and keep `createSurface.catalogId` aligned with the
active catalog.

## Example Strategy

Examples improve accuracy, but they must be catalog-aware. Use examples this
way:

- Prefer examples embedded in the fetched catalog if present.
- Use the embedded examples below as reusable patterns for a form with an
  action, a data-bound repeated view, a chart-like data view, and an action
  response patch.
- Validate embedded examples against the latest catalog before borrowing their
  structure.
  Discard or adapt any example that references missing components, missing props,
  changed required fields, changed enum values, or functions absent from the
  current catalog.
- Do not paste example JSON into the final answer unless it exactly satisfies
  the user's request and the latest catalog.
- If no example fits, generate from the fetched schemas directly.

## Hard Rules

1. Output must be a JSON array of A2UI messages. No prose, Markdown, XML, code
   fences, comments, or trailing commas.
2. Each element must include `"version": "v0.9"`.
3. Output pretty-printed JSON with 2-space indentation. Do not emit minified
   single-line JSON.
4. For a fresh non-action response, the first message must be `createSurface`.
   Use the fetched `catalogId`, and use surface id `"main"` unless the user
   specifies otherwise.
5. For `{ "path": ... }` bindings, send `updateDataModel` before the first
   `updateComponents` message that reads those paths.
6. The first fresh `updateComponents` message must contain exactly one component
   with id `"root"`.
7. Use property-based component discriminators: `"component": "SomeComponent"`,
   not wrapper objects such as `{ "SomeComponent": { ... } }`.
8. Children are referenced by id only. Never inline child components.
9. Child references must point to components present in the same response, or to
   components that already exist on the same surface during a patch.
10. Keep ids kebab-case and unique per surface, such as `"root"`,
    `"title-text"`, and `"submit-button"`.
11. Do not invent components, props, functions, enum values, or action shapes
    outside the latest fetched catalog.
12. If a component has a layout `weight` prop, treat it as a small child layout
    ratio, not CSS font weight. Do not use typography values like `400`, `500`,
    `600`, or `700` unless the latest catalog explicitly defines that meaning.
13. If the user asks for impossible, unsafe, or unsupported UI, return a concise
    explanatory A2UI surface using supported catalog components rather than
    prose.
14. If the latest user message starts with `A2UI_USER_ACTION:`, return a
    non-empty patch for the existing surface. Do not create a new surface unless
    the action explicitly asks to replace the whole UI.
15. For action responses, prefer the smallest valid patch: one `updateDataModel`
    for changed data, plus `updateComponents` only if visible structure needs to
    change.
16. For UI that should change after an interaction, keep the initial response in
    the pre-action state. Put confirmation, success, error, or result details in
    the action response.

## Component Rules

- Components are flat objects in `updateComponents.components`; children are
  referenced by id strings, never nested inline.
- Every component has a unique kebab-case `"id"` and a catalog discriminator
  whose value is one of the keys in the fetched catalog's `components` object.
- The first visible component tree for a fresh UI must include `"id": "root"`.
- If a component schema has `children`, provide the shape allowed by that
  schema. If it has a singular child reference, provide exactly one component
  id. If multiple visual children are needed, use a catalog component whose
  schema accepts multiple children.
- If a component schema requires an action, emit the action shape allowed by
  the fetched schema, with either an allowed event payload or a function call
  whose function name exists in `functions`.
- Do not invent components, props, functions, enum values, or layout fields that
  are not in the active catalog.
- For media-like components, follow the fetched schema for URL/source fields.
  If the host resolves image queries, use a short English search query instead
  of inventing CDN URLs.
- If the user asks for an unsupported or unsafe UI, still return A2UI JSON:
  render a concise explanatory surface using components available in the latest
  catalog instead of returning prose.

## Data Binding

Use literal values for fixed text and simple static UI. Use data-model bindings
when values need to be shared, editable, repeated, or updated after an action.

```json
{ "someProp": "literal value" }
{ "someProp": { "path": "/data/path" } }
```

If a component reads `{ "path": "/..." }`, send a preceding `updateDataModel`
message that creates that value.

For repeated children, use the template shape from the fetched component schema.
When the schema supports `{ "path": "...", "componentId": "..." }`, the
container points to an absolute array path, while template components use
relative item paths.

The corresponding data must be an array of objects:

```json
[
  { "label": "Alpha" },
  { "label": "Beta" }
]
```

Inside the template component tree, bind with `{ "path": "label" }`. Do not use
wildcard paths such as `"/items/*/label"` and do not use `{ "path": "." }`.
Choose the repeated-content component whose fetched schema and description best
match the requested layout and scrolling behavior.

## Action Responses

If the latest user input starts with `A2UI_USER_ACTION:`, update the existing
surface instead of creating a new one. Return a non-empty JSON array with the
smallest valid patch:

- Use `updateDataModel` when only data changed.
- Add `updateComponents` only when visible structure changed.
- Keep the same `surfaceId` unless the action explicitly replaces the UI.

Do not show success, confirmation, or post-action result states in the initial
response before the user action occurs. Put those states in the action response.
For UI that changes after an interaction, keep the initial response in the
pre-action state and rely on the action response patch for confirmation,
success, error, or result details.

## Embedded Example Patterns

These examples are illustrative in-context patterns. Before reusing one, fetch
the latest catalog and confirm every component, prop, enum value, and action
shape still validates. Adapt the component names and props if the current
catalog changed.

### Form With Action

User: `Generate a login card with email, password, and a submit button.`

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "main",
      "catalogId": "https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "main",
      "value": {
        "form": {
          "email": "",
          "password": ""
        }
      }
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Card",
          "child": "form-column"
        },
        {
          "id": "form-column",
          "component": "Column",
          "children": [
            "title",
            "email",
            "password",
            "submit"
          ]
        },
        {
          "id": "title",
          "component": "Text",
          "text": "Sign in",
          "variant": "h2"
        },
        {
          "id": "email",
          "component": "TextField",
          "label": "Email",
          "value": {
            "path": "/form/email"
          }
        },
        {
          "id": "password",
          "component": "TextField",
          "label": "Password",
          "variant": "obscured",
          "value": {
            "path": "/form/password"
          }
        },
        {
          "id": "submit",
          "component": "Button",
          "variant": "primary",
          "child": "submit-label",
          "action": {
            "event": {
              "name": "submit_login",
              "context": {
                "email": {
                  "path": "/form/email"
                },
                "password": {
                  "path": "/form/password"
                }
              }
            }
          }
        },
        {
          "id": "submit-label",
          "component": "Text",
          "text": "Sign in"
        }
      ]
    }
  }
]
```

### Data-Bound Repeated View

User: `Show three trip ideas as a compact vertical group.`

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "main",
      "catalogId": "https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "main",
      "path": "/items",
      "value": [
        {
          "name": "Canal walk",
          "detail": "Morning coffee and quiet bridges"
        },
        {
          "name": "Museum loop",
          "detail": "Design exhibits plus lunch nearby"
        },
        {
          "name": "Sunset hill",
          "detail": "Short climb with skyline views"
        }
      ]
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Column",
          "children": [
            "title",
            "trip-items"
          ]
        },
        {
          "id": "title",
          "component": "Text",
          "text": "Trip ideas",
          "variant": "h2"
        },
        {
          "id": "trip-items",
          "component": "Column",
          "children": {
            "path": "/items",
            "componentId": "trip-row"
          }
        },
        {
          "id": "trip-row",
          "component": "Row",
          "children": [
            "trip-icon",
            "trip-copy"
          ],
          "align": "center"
        },
        {
          "id": "trip-icon",
          "component": "Icon",
          "name": "location_on"
        },
        {
          "id": "trip-copy",
          "component": "Column",
          "children": [
            "trip-name",
            "trip-detail"
          ]
        },
        {
          "id": "trip-name",
          "component": "Text",
          "text": {
            "path": "name"
          },
          "variant": "h3"
        },
        {
          "id": "trip-detail",
          "component": "Text",
          "text": {
            "path": "detail"
          },
          "variant": "body"
        }
      ]
    }
  }
]
```

### Chart-Like Data View

User: `Show weekly active users as a line chart.`

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "main",
      "catalogId": "https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "main",
      "value": {
        "chart": {
          "labels": [
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri"
          ],
          "series": [
            {
              "name": "Users",
              "values": [
                120,
                148,
                132,
                171,
                190
              ]
            }
          ]
        }
      }
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Card",
          "child": "chart-column"
        },
        {
          "id": "chart-column",
          "component": "Column",
          "children": [
            "title",
            "chart"
          ]
        },
        {
          "id": "title",
          "component": "Text",
          "text": "Weekly active users",
          "variant": "h2"
        },
        {
          "id": "chart",
          "component": "LineChart",
          "labels": {
            "path": "/chart/labels"
          },
          "series": {
            "path": "/chart/series"
          },
          "xLabel": "Day",
          "yLabel": "Users",
          "showGrid": true,
          "showLegend": true
        }
      ]
    }
  }
]
```

### Action Response Patch

User:
`A2UI_USER_ACTION: {"surfaceId":"main","action":{"name":"submit_login","context":{"email":"me@example.com"}}}`

```json
[
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "main",
      "path": "/status",
      "value": {
        "kind": "success",
        "message": "Signed in as me@example.com"
      }
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "main",
      "components": [
        {
          "id": "root",
          "component": "Card",
          "child": "status-column"
        },
        {
          "id": "status-column",
          "component": "Column",
          "children": [
            "status-title",
            "status-message"
          ]
        },
        {
          "id": "status-title",
          "component": "Text",
          "text": "Success",
          "variant": "h2"
        },
        {
          "id": "status-message",
          "component": "Text",
          "text": {
            "path": "/status/message"
          }
        }
      ]
    }
  }
]
```

## Validation Checklist

Before final output, verify:

- The first character is `[` and the last character is `]`.
- Every message includes `"version": "v0.9"`.
- A fresh response starts with `createSurface`.
- The first fresh `updateComponents` message contains `root`.
- Every child id reference exists in the same response.
- Bound paths have matching earlier data-model values.
- Repeated templates use object items and relative item fields.
- No component, prop, enum value, function, or action shape is outside the
  latest fetched catalog.
- The JSON parses without comments or trailing commas.
