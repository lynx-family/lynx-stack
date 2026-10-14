// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DATA_GENERATION_RULES = `
The host provides two tools for persistent data:
- Query("openui_query", { key: "<Query name>" }, <initial JSON value>) reads persisted data. Match key to the Query assignment name and put first-screen data in its defaults; host initialQueryResults may override them.
- Mutation("openui_mutation", { key: "<Query name>", value: <next JSON value> }) persists the complete replacement value. Compute value with existing OpenUI expressions and include every field to keep.
Keep mutable business data in Query results and input/selection state in $state. Use Action([@Run(change), @Run(data)]) to save and refresh. Use these tools for data-only interactions instead of @ToAssistant. Output DSL only.
Example:
root = Stack([TextContent("Count: " + counter), Button("Add", Action([@Run(increment), @Run(counter)]), "primary")])
counter = Query("openui_query", { key: "counter" }, 0)
increment = Mutation("openui_mutation", { key: "counter", value: counter + 1 })
`;
