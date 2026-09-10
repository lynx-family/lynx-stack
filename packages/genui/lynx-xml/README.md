# Lynx XML

`@lynx-js/genui-lynx-xml` owns the system prompt used to generate complete,
zero-build `.lynxml` artifacts with Vanilla Lynx and Element PAPI. It also
provides headless utilities for converting well-formed XML fragments into
deterministic Element PAPI JavaScript.

The built-in prompt is composed from selected guidance in the direct,
version-pinned `@lynx-js/skill-vanilla-lynx` dependency plus a small Lynx XML
adaptation layer. The dependency provides shared Element PAPI, lifecycle,
event-routing, background-state, and styling rules. The local layer defines the
single-file XML contract, removes project and external-bundle workflows, and
requires the page root and every container that lays out Element children to
explicitly apply `display: flex` and a `flex-direction`. It also supplies
mobile-first defaults for narrow portrait layouts, responsive sizing, safe
areas, scrolling, spacing, typography, visual hierarchy, and touch targets.
When content can exceed one viewport, the first business node below the Page is
required to be the definite-height vertical `scroll-view`; it is not wrapped in
an additional business `view`. The provider-neutral design intent lives in
`src/mobile-design.ts`; the concrete Element PAPI and `scroll-view` contract
lives in `src/prompt.ts`. That API contract also keeps numeric component ids
separate from Element PAPI node references: both `__AppendElement` arguments
must be nodes, while `pageId` is used only by page-owned element creation APIs.

The selected Markdown is imported and inlined at build time. Consumers do not
need the source skill files at runtime, and the prompt implementation does not
perform filesystem reads.

## Usage

Use the default prompt:

```ts
import { LYNX_XML_SYSTEM_PROMPT } from '@lynx-js/genui-lynx-xml';
```

Customize the engine version or append integration-specific instructions:

```ts
import { buildLynxXmlSystemPrompt } from '@lynx-js/genui-lynx-xml';

const prompt = buildLynxXmlSystemPrompt({
  engineVersion: '4.2',
  appendix: 'Prefer a compact information hierarchy.',
});
```

Convert an XML fragment into main-thread script and stable bindings for its
`id` attributes:

```ts
import { generateMainThreadScriptResult } from '@lynx-js/genui-lynx-xml';

const { bindings, javascript } = generateMainThreadScriptResult(
  '<view id="root"><text>Hello</text></view>',
);
```

Generate an intermediate document with `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT`
and pass it to `compileLynxXmlFragment(source)`. It requires one `<template>` directly inside `<lynx>`, in any order alongside
normal style and script blocks. Static nodes do not need ids; only nodes used by
handlers, updates, or cleanup need unique ids. The model
calls the server-provided `createFragment(page, pageId)` once during rendering
and retains its return value for handlers, for example `nodes["root"]`.

Compilation removes the template and injects a deterministic helper that
creates and appends the tree, then returns the id-to-node map. The helper reuses one temporary element reference and a parent stack,
retaining only nodes with explicit ids in its returned map. No per-element
nodeN variables are generated; the model keeps the map in script-scoped `nodes`. Styles, state, lifecycle, and interactions
remain model-authored. No generated script or bindings need a model round trip.
The result contains the complete `text` and the original `xmlFragment`.

The converter preserves nonempty text whitespace and source order, checks XML,
rejects duplicate ids, and bounds fragment length and nesting. Compilation does
not execute JavaScript. Final rendering remains the consumer's responsibility.
