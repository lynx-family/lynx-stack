---
applyTo: "packages/genui/server/agent/**"
---

When prompting or validating A2UI template children, follow the v0.9 collection scope rules: the container uses an absolute collection path such as `{ "path": "/items", "componentId": "itemRow" }`, while bindings inside the template component tree use relative item paths such as `{ "path": "name" }`. Do not generate or accept wildcard item bindings like `{ "path": "/items/*/name" }`; `*` appears only in validator-internal flattened data-model coverage.

For repeated text values, model collection items as objects such as `{ "label": "Alpha" }` and bind the field with `{ "path": "label" }`. Do not use primitive arrays together with `{ "path": "." }`, because the current renderer does not resolve `.` as the current item.

Do not conflate repeating data with the `List` component. Prefer `Column` template children for ordinary vertical repeated content and `Row` template children for ordinary horizontal repeated content. Reserve `List` for repeated content that needs a scrollable container.
