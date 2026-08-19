---
applyTo: "packages/genui/server/**"
---

When prompting or validating A2UI template children, follow the A2UI collection scope rules: the container uses an absolute collection path such as `{ "path": "/items", "componentId": "itemRow" }`, while bindings inside the template component tree use relative item paths such as `{ "path": "name" }`. Do not generate or accept wildcard item bindings like `{ "path": "/items/*/name" }`; `*` appears only in validator-internal flattened data-model coverage.

For repeated text values, model collection items as objects such as `{ "label": "Alpha" }` and bind the field with `{ "path": "label" }`. Do not use primitive arrays together with `{ "path": "." }`, because the current renderer does not resolve `.` as the current item.

Do not conflate repeating data with the `List` component. Prefer `Column` template children for ordinary vertical repeated content and `Row` template children for ordinary horizontal repeated content. Reserve `List` for repeated content that needs a scrollable container.

For A2UI v1.0, prefer a single `createSurface` with inline `dataModel` and `components` for a complete initial UI, while keeping split update messages for genuinely progressive rendering. This server implements one active catalog and no per-component catalog resolution, so generated `createSurface` messages must include that active `catalogId`. Generate simple snake_case component ids in prompts and examples.

Keep the lean v1.0 server profile limited to `createSurface`, `updateComponents`, `updateDataModel`, and `deleteSurface`. Reuse the validator's single-message schema in streaming code so a partial or structurally invalid envelope is never emitted. In v1.0, `updateDataModel.value` is required and `null` deletes the target; `theme` is not a `createSurface` field. Renderer actions use `{ "version": "v1.0", "action": { ... } }`; keep any versionless legacy adapter thin and isolated at the HTTP boundary.

Project legacy extracted FunctionCall schemas onto the v1.0 `call` / optional `args` / optional `catalogId` shape at the prompt-validator boundary; never prompt for or accept per-call `returnType`. Streaming placeholders are catalog components, so emit `Loading` only when the active catalog declares it; otherwise withhold an unsafe speculative component update instead of inventing a component outside the catalog.
