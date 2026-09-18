# Lynx XML

`@lynx-js/genui/lynx-xml` provides system prompts for generating complete,
zero-build `.lynxml` artifacts with Vanilla Lynx and Element PAPI. It also
compiles XML fragments into deterministic Element PAPI JavaScript.

The package is headless. Consumers provide model calls, streaming, artifact
extraction, and rendering.

## Generation modes

| Mode             | Model output                                                        | Consumer action                                              |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Direct (default) | A complete `.lynxml` document with model-authored Element PAPI code | Pass the document to the renderer                            |
| XML fragment     | An intermediate `.lynxml` document containing a `<template>`        | Call `compileLynxXmlFragment`, then render its `text` result |

Both modes keep styles, state, lifecycle, and interactions model-authored.
Fragment mode generates the static element tree deterministically, without an
additional model round trip.

## Build a system prompt

Use the default prompt for direct generation:

```ts
import { LYNX_XML_SYSTEM_PROMPT } from '@lynx-js/genui/lynx-xml';
```

Customize the engine version or append integration-specific instructions:

```ts
import { buildLynxXmlSystemPrompt } from '@lynx-js/genui/lynx-xml';

const prompt = buildLynxXmlSystemPrompt({
  engineVersion: '4.2',
  appendix: 'Prefer a compact information hierarchy.',
});
```

`engineVersion` defaults to `4.2`. Set `enableHtmlFragment: true` to select
fragment mode; it defaults to `false`. `appendix` is appended after the built-in
instructions.

## Compile an XML fragment document

Use `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT` for fragment generation, or build a
custom prompt with `enableHtmlFragment: true`:

```ts
import {
  compileLynxXmlFragment,
  LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT,
} from '@lynx-js/genui/lynx-xml';

const prompt = LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT;

// Call this with the complete intermediate document returned by the model.
function compileModelOutput(source: string) {
  const { text, xmlFragment } = compileLynxXmlFragment(source);
  return { text, xmlFragment };
}
```

The intermediate document must follow these rules:

- Include exactly one `<template>` directly inside `<lynx>`, alongside normal
  style and script blocks in any order, with exactly one main-thread script.
- Assign unique ids only to nodes needed by handlers, updates, or cleanup.
  Static nodes do not need ids.
- Call `createFragment(page, pageId)` exactly once during rendering. Keep its
  returned id-to-node map in script-scoped `nodes` for later use, such as
  `nodes["root"]`. The compiler supplies the helper; the model must not declare
  or shadow it.

Compilation removes the template and injects `createFragment`, which creates
and appends the tree and returns only nodes with explicit ids. The result has
two fields:

- `text`: the complete `.lynxml` document to render.
- `xmlFragment`: the original XML inside the template.

Compilation validates the document and fragment without executing JavaScript.
It preserves source order and whitespace within nonempty text, rejects duplicate
ids, and bounds fragment length and nesting. Rendering remains the consumer's
responsibility.

### Convert a standalone fragment

For custom compilation pipelines, convert an XML fragment directly into
main-thread JavaScript:

```ts
import { generateMainThreadScriptResult } from '@lynx-js/genui/lynx-xml';

const { bindings, javascript } = generateMainThreadScriptResult(
  '<view id="root"><text>Hello</text></view>',
);
```

The generated `javascript` expects `page` and `pageId` in scope and creates a
`nodeMap`. `bindings` maps explicit XML ids to JavaScript expression strings,
for example `{ root: 'nodeMap["root"]' }`; it does not contain live nodes.
Use `generateMainThreadScript` when only the JavaScript string is needed.

## Prompt composition and constraints

The prompt combines selected guidance from the pinned
`@lynx-js/skill-vanilla-lynx` dependency with local rules in
[`src/prompt.ts`](./src/prompt.ts). Shared guidance covers Element PAPI,
lifecycle, event routing, background state, and styling. It is inlined at build
time, so consumers need no skill files or filesystem reads at runtime.

The local prompt adapts that guidance to single-file `.lynxml` artifacts and
takes precedence over imported guidance. Its key constraints are:

- **Node references:** `__AppendElement` and append helpers receive nodes,
  not numeric ids. `pageId` is reserved for page-owned element creation APIs.
- **Layout:** the Page and every container that lays out Element children use
  applied classes with explicit `display: flex` and `flex-direction`.
- **Scrolling:** content that can exceed one viewport uses a definite-height
  vertical `scroll-view` as the first business node directly below the Page,
  without a business `view` wrapper. Fixed bars reserve scroll content space,
  including safe-area insets.
- **Artifact boundaries:** all code stays in the document, without imports,
  packages, dynamic code execution, external scripts, analytics, or tracking.
  Asset and link URLs come from the user, host, or enabled search/image tools.
  Runtime fetching is limited to explicitly requested integrations on the
  background thread.

Product and mobile design defaults are composed separately by GenUI Server in
[`design-guidance.ts`](../server/design/design-guidance.ts). The local prompt
owns the concrete Lynx runtime, layout, and artifact constraints.
