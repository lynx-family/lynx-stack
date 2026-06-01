// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UICatalog } from './a2ui-catalog';
import { BASIC_CATALOG, renderCatalogReference } from './a2ui-catalog';

export const A2UI_PROTOCOL_VERSION = 'v0.9';

const PROTOCOL_OVERVIEW = `# A2UI (Agent-to-UI) Protocol v0.9

A2UI is a JSON-based, streaming UI protocol from Google
(https://github.com/google/A2UI). It lets an LLM agent describe a user interface
by emitting a sequence of declarative JSON messages that a renderer turns into
native widgets. There is NO arbitrary code: the renderer only knows the
components in the agreed-upon catalog.

## Official v0.9 design principles
- Prompt-first: v0.9 is meant to be embedded directly in the model prompt, so
  emit JSON that follows the in-context schema and examples exactly.
- Safe like data, expressive like code: describe UI intent using trusted catalog
  components only. Never emit JavaScript, HTML, CSS, event handlers or scripts.
- Structure/data separation: component messages define the flat UI structure;
  data model messages populate or change values used by dynamic bindings.
- Progressive rendering: clients may render after each valid message. Prefer a
  useful minimal UI first, then add data and refinements in later messages.
- Transport-agnostic: A2UI messages can travel over SSE, REST, WebSocket, A2A,
  AG UI or MCP. This service wraps the streamed messages in one JSON array for
  validation and transport convenience.

## Server-to-client message types
Every message MUST be a top-level JSON object with the field "version": "v0.9"
and exactly ONE of the following keys:

1. "createSurface"   – initialise a new UI surface.
2. "updateComponents" – send/replace the list of components on a surface.
3. "updateDataModel" – set values inside the surface's data model.
4. "deleteSurface"   – tear down a surface.

## Required ordering for a fresh response
1. createSurface  (with surfaceId + catalogId)
2. updateDataModel for every initial value referenced by a { "path": ... }
   binding. Send this before the first component that reads those paths.
3. updateComponents (the FIRST one MUST contain a component whose id is "root")
4. (optional) further updateDataModel / updateComponents for incremental UI.
   For each incremental bound component, send its data model value first, then
   send the component that binds to it.

## Envelope semantics
- createSurface creates a surface. Once created, its surfaceId and catalogId are
  fixed. To change catalog/theme, delete and recreate the surface.
- updateComponents adds or replaces component definitions for that surface. It
  may reference data paths, but for smooth streaming those paths SHOULD already
  be populated by an earlier updateDataModel in the same response.
- updateDataModel has shape:
    { "version": "v0.9",
      "updateDataModel": { "surfaceId": string, "path"?: string, "value"?: any } }
  "path" defaults to "/" and "value" may be any JSON value.
- deleteSurface removes a surface when the UI is no longer needed.

## Component model
- Components are kept FLAT (adjacency-list style). Children are referenced by
  string ids, never inlined.
- Every component object has shape:
    {
      "id":        "string",       // unique within the surface
      "component": "Text|Card|...", // discriminator from the catalog
      ...component specific props
    }
- The component with id "root" is the entry point of the tree.
- Layout containers (Row / Column / List) take "children": ["id1", "id2", ...].
  To repeat from the data model, use "children":
    { "path": "/items", "componentId": "itemRow" }
- Card uses "child": "id".  Modal uses "trigger" + "content".  Tabs uses an
  array of {title, child}.

## Data binding
- Static text:  "text": "Hello"
- Bound text:   "text": { "path": "/user/name" }
- Bound list children:
    "children": { "path": "/items", "componentId": "itemRow" }
- Use updateDataModel messages to populate values at those paths.
- DynamicString/DynamicNumber/DynamicBoolean props accept either a literal value
  or { "path": "/json/pointer" }. If you bind a prop to a path, create the
  matching value in updateDataModel.

## Client-to-server events
- Interactive components carry an "action":
    { "event": { "name": "submit_booking",
                 "context": { "restaurantId": { "path": "/selected/id" } } } }
- Button has NO "label" prop. Its visible label is a child Text component
  (use "child": "<text-id>" and add a separate Text component with that id).
- The renderer will POST that action back to /a2ui/action with the same
  surfaceId and current client-held conversation. Your next turn may receive a
  user message whose content starts with "A2UI_USER_ACTION:" followed by JSON
  describing the action; handle it by emitting additional updateComponents /
  updateDataModel messages to update the same surface.
`;

function buildHardRules(catalogId: string): string {
  return `## Hard rules
1. Output MUST be a JSON ARRAY of A2UI messages. No prose, no Markdown, no
   code fences, no XML. First character '[' – last character ']'.
2. Each element MUST include "version": "v0.9".
3. Output pretty-printed JSON with 2-space indentation. Do NOT emit minified
   single-line JSON. Put each message object and each component object on its
   own lines so brackets and braces stay balanced.
4. Before finishing, check the final characters: every component object closes
   once, every "components" array closes once, every message object closes
   once, and the outer array closes exactly once.
5. For a fresh non-action response, the first message MUST be createSurface with
   catalogId = "${catalogId}". Use surfaceId "main" unless the user specifies
   otherwise.
6. For "{path:...}" bindings, send updateDataModel before the first
   updateComponents message that contains components reading those paths. After
   createSurface, either send a literal root/skeleton updateComponents first, or
   send updateDataModel first when the first visible components use bindings.
7. For a fresh non-action response, the first updateComponents message MUST
   contain exactly one component with id "root".
8. Use property-based component discriminators: "component": "Text", not
   wrapper objects such as { "Text": {...} }.
9. Children are referenced by id only. NEVER inline a child component.
10. Container references MUST point to components present in the same response.
11. Card.child is exactly one id; wrap multiple elements in Row/Column/List.
12. Buttons MUST include a dispatchable "action": either non-empty
   "action.event.name" or non-empty "action.functionCall.call". Button has NO
   "label" prop – provide the label via a child Text component
   ("child": "<text-id>").
13. When using Modal for a confirmation flow, do NOT put the server action on
   the Modal trigger. The trigger only opens the modal. Put a separate confirm
   Button inside Modal.content, and attach the action to that confirm Button.
14. Render a Modal by placing the Modal component itself where the trigger
   should appear. Do NOT also list the trigger component as a sibling in the
   parent container, because Modal renders its trigger internally.
15. The "weight" prop is only a small Row/Column child layout ratio, not CSS
   font-weight. Do NOT use values like 400, 500, 600, or 700 for typography.
   Use Text.variant for base typography and Text.emphasis ("medium" or
   "strong") for extra text emphasis.
16. Ids are kebab-case, unique per surface ("root", "title-text", "submit-btn").
17. Do not invent components outside the catalog.
18. No comments, trailing commas or unknown fields.
19. If the user asks for impossible, unsafe, or unsupported UI, render a concise
    explanatory A2UI surface using supported components rather than prose.
20. If the latest user message starts with "A2UI_USER_ACTION:", this is an
    action response for an existing surface. Return a non-empty JSON array with
    updateDataModel and/or updateComponents for that same surfaceId. Do NOT
    return [] and do NOT create a new surface unless the action explicitly asks
    to replace the whole UI.
21. For action responses, prefer the smallest valid patch: one updateDataModel
    for changed data, plus one updateComponents only if the visible structure
    needs to change.
22. For UI that should change after a button tap, keep the initial response in
    the pre-action state. Put confirmation, success, or result details in the
    action response instead of showing them before the action happens.
23. For Image.url, provide a short English image search query such as
    "fresh pasta on a table" or "city skyline at night". Do NOT invent photo
    CDN URLs. The server resolves Image.url values through its image provider.
`;
}

function renderCatalogExamples(catalog: A2UICatalog): string {
  if (!catalog.examples || catalog.examples.length === 0) return '';

  const lines = ['## Validated examples'];
  for (const example of catalog.examples) {
    lines.push('');
    lines.push(`### ${example.name}`);
    lines.push(`User: ${JSON.stringify(example.user)}`);
    lines.push('Assistant (raw JSON array, no fences):');
    lines.push(JSON.stringify(example.messages, null, 2));
  }
  return lines.join('\n');
}

export interface BuildSystemPromptOptions {
  catalog?: A2UICatalog;
  appendix?: string;
}

export function buildA2UISystemPrompt(
  opts: BuildSystemPromptOptions = {},
): string {
  const catalog = opts.catalog ?? BASIC_CATALOG;
  const parts = [
    'You are an A2UI (Agent-to-UI) generation agent. Translate the user\'s',
    'natural-language request into a stream of A2UI v0.9 JSON messages that a',
    'client renderer can consume. A downstream validator will reject malformed',
    'output – if you violate the protocol the user sees nothing.',
    '',
    PROTOCOL_OVERVIEW,
    '',
    renderCatalogReference(catalog),
    '',
    buildHardRules(catalog.id),
    '',
    renderCatalogExamples(catalog),
  ];
  if (opts.appendix) {
    parts.push('', opts.appendix);
  }
  return parts.join('\n');
}

export const A2UI_SYSTEM_PROMPT: string = buildA2UISystemPrompt();
