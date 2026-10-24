# Artifacts and validation

Use the public `@lynx-js/genui/lynx-xml` entry point to prepare model output for
delivery to a Lynx XML renderer. Keep the prompt options and transformation options
aligned.

## Extract, normalize, and validate an artifact

```ts
import { normalizeLynxXmlArtifact } from '@lynx-js/genui/lynx-xml';

// Return the extracted, normalized artifact or throw on invalid structure.
const source = normalizeLynxXmlArtifact(modelOutput);
```

`normalizeLynxXmlArtifact` extracts the artifact from prose or Markdown fences and adds a
missing `<!doctype lynx>` when a `<lynx>` root is present. It throws when no
artifact is found or the artifact structure contract is invalid. Normalization
requires `<lynx engine-version="...">`, a closing `</lynx>`, exactly one closed
`<script thread="main">`, and no CDATA sections. Transform intermediate Template
or ScriptReuse artifacts before normalizing and validating the final artifact.

`assembleLynxXmlArtifact` extracts intermediate artifacts internally, so callers
can pass the original model response directly. Extraction is an internal utility
and is not exported from the package entry point.

These checks preserve the existing GenUI agent contract. They do not parse
JavaScript or CSS, validate Element PAPI semantics, or establish rendering
correctness. Transformation performs additional static checks for its enabled modes;
the Lynx runtime remains responsible for execution and rendering.

## Transform model output

Use one transformation entry point for all option combinations:

```ts
import {
  assembleLynxXmlArtifact,
  normalizeLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const options = {
  enableHtmlFragment: true,
  enableScriptReuse: true,
  stylePreset: 'default',
} as const;

const { text, xmlFragment } = assembleLynxXmlArtifact(modelOutput, options);
const artifact = normalizeLynxXmlArtifact(text);
```

Pass the original complete model response to `assembleLynxXmlArtifact`; it
extracts the source and applies enabled Template, ScriptReuse, and StylePreset
transformations. `text` is the transformed artifact;
`xmlFragment` is present when Template is enabled. Keep the original response
separately for conversation history and diagnostics.

Normalization does not perform those transformations. Apply it to the transformed
result before delivery. For Direct mode with all options disabled, normalize
the model output directly.

## Transform a template artifact

Use `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT` for template generation, or build a
custom prompt with `enableHtmlFragment: true`:

```ts
import {
  assembleLynxXmlArtifact,
  LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT,
} from '@lynx-js/genui/lynx-xml';

const prompt = LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT;

// Call this with the complete intermediate artifact returned by the model.
function transformModelOutput(source: string) {
  const { text, xmlFragment } = assembleLynxXmlArtifact(source, {
    enableHtmlFragment: true,
  });
  return { text, xmlFragment };
}
```

The intermediate artifact must follow these rules:

- Include exactly one `<template>` directly inside `<lynx>`, alongside normal
  style and script blocks in any order, with exactly one main-thread script.
- Assign unique ids only to nodes needed by handlers, updates, or cleanup.
  Static nodes do not need ids.
- Call `createFragment(page, pageId)` exactly once during rendering. Keep its
  returned id-to-node map in script-scoped `nodes` for later use, such as
  `nodes["root"]`. The transformer supplies the helper; the model must not declare
  or shadow it.

Transformation removes the template and injects `createFragment`, which creates
and appends the tree and returns only nodes with explicit ids. The result has
two fields:

- `text`: the complete `.lynxml` artifact to render.
- `xmlFragment`: the original XML inside the template.

Transformation validates the artifact and fragment without executing JavaScript.
It preserves source order and whitespace within nonempty text, rejects duplicate
ids, and bounds fragment length and nesting. Rendering remains the consumer's
responsibility.

### Optional StylePreset transformation

Use the same `stylePreset` option for prompt construction and transformation:

```ts
import {
  buildLynxXmlSystemPrompt,
  assembleLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const stylePreset = 'default';
const prompt = buildLynxXmlSystemPrompt({
  enableHtmlFragment: true,
  stylePreset,
});

// The model can write class="flex flex-col gap-4 p-6 bg-slate-50".
const { text } = assembleLynxXmlArtifact(modelOutput, {
  enableHtmlFragment: true,
  stylePreset,
});
```

Omitting `stylePreset` or setting it to `false` disables preset styling.
StylePreset is independent of Template. For a direct Element PAPI artifact:

```ts
import { applyLynxXmlStylePreset } from '@lynx-js/genui/lynx-xml';

const prompt = buildLynxXmlSystemPrompt({ stylePreset: 'default' });
// The model uses __SetClasses(node, 'flex flex-col p-4') without a template.
const text = applyLynxXmlStylePreset(source, 'default');
```

Here `source` is an already-extracted complete Direct artifact. To process raw
model output directly, prefer
`assembleLynxXmlArtifact(modelOutput, { stylePreset: 'default' })`.

`'default'` enables the built-in StylePreset, a finite Lynx utility vocabulary.
The transformer collects classes from the template and complete string
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
does not register a class. JavaScript is never executed during transformation.
The resulting artifact remains self-contained: no stylesheet download or build
configuration is required. The model saves output tokens by referencing classes;
the preset vocabulary adds input tokens, and the transformed artifact still contains
the resolved CSS. Measure generation latency and token usage for the actual task.

GenUI Create exposes **Design**, **Template**, and **StylePreset** as independent
checkboxes, all enabled for new records. Changes are saved with the current
record and restored on selection or reload. Once a conversation has generated
history, these options are read-only; start a new conversation to change them.
Template transforms markup to Element
PAPI; StylePreset supplies the built-in utility CSS for either source format.
New Lynx XML Bench groups also default all three options on and save them in
their plans; historical settings are preserved.
The Template setting uses the existing `enableHtmlFragment` option.
Server requests select Template with `enableHtmlFragment: true` and StylePreset
with `stylePreset: 'default'` independently; both remain opt-in at the API level.
Final metadata records the selected preset.

### Optional ScriptReuse transformation

Set `enableScriptReuse: true` in both `buildLynxXmlSystemPrompt` and
`assembleLynxXmlArtifact`. It defaults to `false` at the API level, independently of Template
and StylePreset. During ScriptReuse transformation, the agent supplies page creation, lifecycle
registration, render guarding, event cleanup, and UI helpers locally. The model only writes
business state and synchronous callbacks:

```xml
<!doctype lynx>
<lynx engine-version="4.2">
<template><text id="count">0</text></template>
<script thread="main">
let count = 0;
definePage({
  render(ctx) {
    ctx.on(ctx.nodes.count, "tap", () => ctx.setText(ctx.nodes.count, ++count));
  },
  update(ctx, patch) {
    if (typeof patch.count === "number") count = patch.count;
    ctx.setText(ctx.nodes.count, count);
  }
});
</script>
</lynx>
```

This is an intermediate contract, not directly runnable XML. Transform it before
preview or delivery:

```ts
import {
  assembleLynxXmlArtifact,
  buildLynxXmlSystemPrompt,
} from '@lynx-js/genui/lynx-xml';

const options = { enableHtmlFragment: true, enableScriptReuse: true };
const prompt = buildLynxXmlSystemPrompt(options);
const { text } = assembleLynxXmlArtifact(modelOutput, options);
```

`definePage` must appear exactly once at top level with an object containing
optional `render(ctx, data)`, `update(ctx, patch)`, and `destroy(ctx)` hooks.
Without Template, `render` is required and creates the business tree with
Element PAPI. `ctx.page`, `ctx.pageId`, and `ctx.nodes` exist before render.
With Template, the initial tree and node map are already created.
Template plus ScriptReuse exposes only task-oriented UI helpers to model code:
`ctx.createView()`, `ctx.createScrollView()`, `ctx.createText(value)`,
`ctx.createImage()`, `ctx.append(parent, child)`,
`ctx.replaceChildren(parent, children)`, `ctx.setText(textNode, value)`,
`ctx.setClasses(node, classes)`, `ctx.setAttribute(node, name, value)`, and
`ctx.setInlineStyles(node, styles)`. The shared runtime translates these calls
to Element PAPI; raw Element PAPI remains accepted for compatibility but is not
part of this mode's model-facing contract.
`ctx.on(node, name, handler, options?)` and
`ctx.listen(name, handler)` return an unsubscribe function.
`ctx.emit(name, data)` uses the shared main-thread local event context.
`ctx.replaceChildren` automatically removes listeners from discarded
subtrees while preserving listeners on reused nodes. Remaining listeners are
removed on destroy.
`ctx.setText(textNode, value)` replaces text children. Initial rendering uses
the SDK flush; update and registered event callbacks flush automatically. Use
`ctx.flush()` only after mutations made by another synchronous callback.
Hooks receive the first object in engine `event.data`, defaulting to `{}`.
Business state merging remains model-owned. Generated app events use one
shared main-thread local context; `destroy` releases page-owned resources.

Create and Bench expose a **ScriptReuse** switch, on by default for new
conversations and comparison groups, matching StylePreset. Explicit saved values
are preserved; missing Create settings default on, while historical Bench plans
and reports without the option keep it off. HTTP callers use
`POST /lynx-xml/stream` with `"enableScriptReuse": true`.
The final metadata retains `modelOutput` and records `enableScriptReuse: true`.
Streaming still shows original deltas; preview and Judge receive the transformed
standalone artifact. Invalid contracts retain model usage and use the existing
repair policy; transformation never executes model code or adds a model call.
Create sends the saved original assistant output in subsequent requests when
ScriptReuse is enabled, avoiding resending injected helpers. Older records
without original output fall back to their saved artifact.

This removes repeated script generation and redundant lifecycle prompt sections.
When Template and ScriptReuse are both enabled, the prompt also uses a compact
selection from the pinned Vanilla Lynx skill: artifact rules, opaque element
handling, text/image update constraints, and local event payloads. The
`definePage`/`ctx` contract replaces raw Element PAPI signatures, initial-tree
construction, engine lifecycle registration, and low-level listener
instructions. Dynamic subtree
replacement still requires unsubscribing listeners on discarded nodes and their
descendants. All styling guidance, including the complete CSS property lists,
is retained. This selection applies with StylePreset on or off and requires no
additional switch; other option combinations keep their existing guidance.

It does not reduce the final runtime artifact by the same amount: the shared
implementation is inlined locally. Compare identical Bench groups with only
ScriptReuse changed, checking input/output tokens, generation duration, validity,
and Judge results. Provider token counts and real latency are required to quantify
the savings; source character counts alone do not establish them.

### Transform a standalone fragment

For custom transformation pipelines, transform an XML fragment directly into
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

## Streaming and failures

These APIs take a string and return synchronously; they do not call a model or
manage a stream. Accumulate model deltas and transform the complete response
before rendering. Partial output can lack closing tags or registration code and
is not a final artifact.

Catch transformation and normalization errors at the integration boundary. A repair
flow can provide the error and original request to the model, with a bounded
retry count. Retain the original output and usage information when a generation
fails. Successful normalization establishes the artifact structure contract only;
use a Lynx runtime preview to check execution and rendering.

Continue with [System prompts](./system-prompts.md) or return to the
[Introduction](../README.md).
