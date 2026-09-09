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

For handlers defined outside `renderPage()`, pass `{ nodeScope: 'script' }` as
the second argument. The result then includes `declarations` containing hoisted
one `var node0, node1, ...;` declaration. Place it at the start of the main-thread
script, after any directives such as `"use strict"`, and put
`javascript` inside `renderPage()` after creating `page` and `pageId`. The GenUI
server's conversion tool handles this assembly automatically. Nodes are assigned
on each render; handlers may use the returned bindings after rendering and must
not redeclare or shadow those names. Omitting the option keeps the original local
`const` declaration behavior.

Bindings map XML ids to JavaScript variable names: `{ cityText: 'node5' }`
means updates should reference `node5`. Setting an XML id does not declare
`cityText`. When assembling the script, consumers may
call `resolveFragmentBindings(javascript, bindings, declarations)` to insert the
combined declaration after directives and convert undeclared XML-id
references into generated node references. The server does this before delivery.
The resolver preserves locally declared variables and property names, and rejects
references whose generated node name is shadowed. Fragment roots are already
appended to `page`; do not append them again after inserting the fragment.

The package intentionally has no model-provider, agent-runtime, or renderer
dependencies. Consumers own those integration concerns.
