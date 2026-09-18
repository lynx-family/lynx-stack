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
| Template         | An intermediate `.lynxml` document containing a `<template>`        | Call `compileLynxXmlFragment`, then render its `text` result |

Both modes keep state, lifecycle, and interactions model-authored. Styles are
model-authored unless the optional StylePreset is enabled.
Template mode generates the static element tree deterministically, without an
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
Template mode; it defaults to `false`. `appendix` is appended after the built-in
instructions.

## Compile a template document

Use `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT` for template generation, or build a
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

### Optional StylePreset

Use the same `stylePreset` option for prompt construction and conversion:

```ts
import {
  buildLynxXmlSystemPrompt,
  compileLynxXmlFragment,
} from '@lynx-js/genui/lynx-xml';

const stylePreset = 'default';
const prompt = buildLynxXmlSystemPrompt({
  enableHtmlFragment: true,
  stylePreset,
});

// The model can write class="flex flex-col gap-4 p-6 bg-slate-50".
const { text } = compileLynxXmlFragment(modelOutput, { stylePreset });
```

Omitting `stylePreset` or setting it to `false` disables preset styling.
StylePreset is independent of Template. For a direct Element PAPI document:

```ts
import { applyLynxXmlStylePreset } from '@lynx-js/genui/lynx-xml';

const prompt = buildLynxXmlSystemPrompt({ stylePreset: 'default' });
// The model uses __SetClasses(node, 'flex flex-col p-4') without a template.
const text = applyLynxXmlStylePreset(modelOutput, 'default');
```

`'default'` enables the built-in StylePreset, a finite Lynx utility vocabulary.
The converter collects classes from the template and complete string
literals in the authored main-thread script, then injects only matching rules
before authored styles in a single `<style>` block. Multiple authored style
blocks are merged in source order. Rule order is stable and independent of
class order;
same-specificity custom CSS can override the preset. Unknown classes remain
available for custom styles. Avoid conflicting utilities for the same property.

The preset includes Flex layout, spacing and sizing (4px steps), typography,
colors, rounded corners, borders, opacity, and overflow. For example, `p-4`
means `padding: 16px`, `text-lg` sets only `font-size: 18px`, and `border` sets
a solid 1px border. Values are literal px/hex values. There is no automatic
reset, CSS variable, arbitrary value, fractional size, variant
such as `hover:` or `sm:`, or `@apply` support. Use custom CSS for these needs.
The complete supported vocabulary is included in the enabled system prompt.

Dynamic state classes must appear as complete literals, such as
`active ? 'bg-blue-500' : 'bg-gray-100'`; concatenating `'bg-' + color + '-500'`
does not register a class. JavaScript is never executed during conversion.
The resulting document remains self-contained: no stylesheet download or build
configuration is required. The model saves output tokens by referencing classes;
the preset vocabulary adds input tokens, and the compiled artifact still contains
the resolved CSS. Measure generation latency and token usage for the actual task.

GenUI Create exposes **Design**, **Template**, and **StylePreset** as independent
checkboxes, all enabled for new records. Changes are saved with the current
record and restored on selection or reload. Once a conversation has generated
history, these options are read-only; start a new conversation to change them.
Template converts markup to Element
PAPI; StylePreset supplies the built-in utility CSS for either source format.
New Lynx XML Bench groups also default all three options on and save them in
their plans; historical settings are preserved.
The Template setting uses the existing `enableHtmlFragment` option.
Server requests select Template with `enableHtmlFragment: true` and StylePreset
with `stylePreset: 'default'` independently; both remain opt-in at the API level.
Final metadata records the selected preset.

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
The result also includes deduplicated `classNames` from template attributes.
Use `generateMainThreadScript` when only the JavaScript string is needed.

## Prompt composition and constraints

The prompt combines selected guidance from the pinned
`@lynx-js/skill-vanilla-lynx` dependency with local rules in
[`src/prompt.ts`](./src/prompt.ts). Shared guidance covers Element PAPI,
lifecycle, event routing, background state, and styling. It is inlined at build
time, so consumers need no skill files or filesystem reads at runtime.
Code examples are omitted, while plain-text constraint lists, including allowed
and forbidden CSS properties, are retained without Markdown fences.

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
