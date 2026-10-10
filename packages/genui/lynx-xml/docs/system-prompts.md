# System prompts

Build the model instruction for the same Lynx XML contract that your transformation
pipeline expects. The package provides a programmatic prompt builder; model
calls and provider configuration belong to the consumer.

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

## Prompt options

| Option               | Default  | Purpose                                                                              |
| -------------------- | -------- | ------------------------------------------------------------------------------------ |
| `engineVersion`      | `'4.2'`  | Target engine version in the generated root. Accepts dot-separated numeric segments. |
| `enableHtmlFragment` | `false`  | Generate an intermediate artifact with one initial-tree `<template>`.                |
| `enableScriptReuse`  | `false`  | Generate `definePage` callbacks for ScriptReuse transformation.                      |
| `stylePreset`        | Disabled | Set to `'default'` to describe the built-in Lynx utility classes.                    |
| `appendix`           | None     | Append trimmed application-specific instructions after the built-in contract.        |

Template, ScriptReuse, and StylePreset are independent. Pass the same three
transformation options to `assembleLynxXmlArtifact`:

```ts
import {
  assembleLynxXmlArtifact,
  buildLynxXmlSystemPrompt,
  normalizeLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const options = {
  enableHtmlFragment: true,
  enableScriptReuse: true,
  stylePreset: 'default',
} as const;
const systemPrompt = buildLynxXmlSystemPrompt({
  ...options,
  appendix: 'Use the product terminology supplied in the user request.',
});

// Send systemPrompt to your model, then process its complete response.
const { text } = assembleLynxXmlArtifact(modelOutput, options);
const artifact = normalizeLynxXmlArtifact(text);
```

The API defaults keep all three features off. GenUI Create and new Lynx XML
Bench groups enable them by default; those product defaults do not change the
package API defaults. Design guidance is a separate Server feature, not a
`buildLynxXmlSystemPrompt` option.

## Other prompt exports

| Export                                 | Purpose                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| `LYNX_XML_SYSTEM_PROMPT`               | Prebuilt Direct prompt with default options.                        |
| `LYNX_XML_HTML_FRAGMENT_SYSTEM_PROMPT` | Prebuilt Template prompt with ScriptReuse and StylePreset disabled. |
| `LYNX_XML_HTML_FRAGMENT_INSTRUCTIONS`  | Template-specific intermediate source contract.                     |

Prefer `buildLynxXmlSystemPrompt` when options differ across requests. An appendix
can add application policy while preserving the artifact, lifecycle, and
layout contract required by the transformer.

## Prompt composition and constraints

The prompt combines selected guidance from the pinned
`@lynx-js/skill-vanilla-lynx` dependency with local rules in
`src/prompt.ts`. Shared guidance covers Element PAPI,
lifecycle, main-thread local events, and styling. It is inlined at build
time, so consumers need no skill files or filesystem reads at runtime.
Code examples are omitted, while plain-text constraint lists, including allowed
and forbidden CSS properties, are retained without Markdown fences.
Mixed runtime sections retain their main-thread requirements while removing
background and cross-thread instructions. The styling reference is preserved
without this filtering, including CSS background properties.

The local prompt adapts that guidance to single-file `.lynxml` artifacts and
takes precedence over imported guidance. Its key constraints are:

- **Node references:** `__AppendElement` and append helpers receive nodes,
  not numeric ids. In Element PAPI calls, `pageId` is reserved for page-owned
  element creation APIs. With Template, this rule covers later JavaScript
  updates; initial nodes come from `nodes` or `ctx.nodes`.
- **Layout:** the Page and every container that lays out Element children use
  applied classes with explicit `display: flex` and `flex-direction`.
  ScriptReuse supplies the Page and its `genui-page` class; generated code uses
  `ctx.page` and `ctx.pageId` and styles the business containers.
- **Scrolling:** use a definite-height vertical `scroll-view` as the default
  first business node directly below the Page, including when content height is
  uncertain. Use a non-scrolling `view` only when the user explicitly requests
  a fixed single-screen layout; merely fitting one viewport is not an exception.
  Do not wrap the scroll view in a business `view`. Fixed bars reserve scroll
  content space, including safe-area insets. Template expresses this as XML
  roots; direct mode creates and appends nodes with Element PAPI.
- **Preset styling:** with StylePreset, layout and scrolling instructions use
  preset classes such as `flex flex-col w-full h-screen` and `shrink-0`.
  Without it, the model authors the corresponding CSS classes.
- **Payloads:** without ScriptReuse, validate lifecycle and app-event payloads.
  ScriptReuse normalizes lifecycle payloads before invoking hooks; business
  fields and app-event payloads still need validation.
- **Artifact boundaries:** all code stays in the artifact, without imports,
  packages, dynamic code execution, external scripts, analytics, or tracking.
  Asset and link URLs come from the user, host, or enabled search/image tools.
  Generated scripts keep runtime behavior local and do not make network requests.

The adaptation contract combines Template, ScriptReuse, and StylePreset
constraints independently. It focuses on node/scope correctness, explicit
layout, scrolling/safe areas, and CSS value limits. Node-map access,
initial-tree transformation, and lifecycle ownership are defined in the
[artifact guide](./artifact-guide.md) instead of being repeated here.
All eight combinations have complete prompt snapshots in
`test/__snapshots__/prompt/`, one readable text file per mode.

Product and mobile design defaults are composed separately by GenUI Server in
`packages/genui/server/design/design-guidance.ts`. The local prompt
owns the concrete Lynx runtime, layout, and artifact constraints.

For transformation and validation details, continue with
[Artifacts and validation](./artifact-guide.md).
