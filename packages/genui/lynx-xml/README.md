# Lynx XML

English | [简体中文](./README_zh.md)

`@lynx-js/genui/lynx-xml` provides system prompts, deterministic transformation, and
artifact extraction, normalization, and validation for complete, zero-build `.lynxml` artifacts. Models
generate Vanilla Lynx UI using Element PAPI, with optional Template, ScriptReuse, and StylePreset transformations.

The package is headless. Your application owns model calls, streaming, artifact
storage, and a Lynx XML renderer. Generated artifacts contain executable
JavaScript and CSS and do not require an A2UI Catalog, an OpenUI Library, or a
ReactLynx component renderer.

## Install

```sh
pnpm add @lynx-js/genui
```

## Quick start

For Direct generation, send the system prompt to your model and extract, normalize,
and validate the artifact from its complete response:

```ts
import {
  buildLynxXmlSystemPrompt,
  normalizeLynxXmlArtifact,
} from '@lynx-js/genui/lynx-xml';

const systemPrompt = buildLynxXmlSystemPrompt();

// Your model integration produces modelOutput using systemPrompt.
const artifact = normalizeLynxXmlArtifact(modelOutput);
// Deliver artifact to your Lynx XML renderer or save it as a .lynxml file.
```

`normalizeLynxXmlArtifact` extracts an artifact from prose or Markdown fences,
adds a missing doctype, and throws when the artifact structure contract is invalid.
It does not execute JavaScript or validate CSS, Element PAPI semantics, or
rendering correctness.

For Template, ScriptReuse, or StylePreset, use matching prompt and transformation
options, then normalize and validate the transformed artifact:

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
const systemPrompt = buildLynxXmlSystemPrompt(options);

// Your model integration produces modelOutput using systemPrompt.
const { text } = assembleLynxXmlArtifact(modelOutput, options);
const artifact = normalizeLynxXmlArtifact(text);
```

Template and ScriptReuse output is an intermediate contract. Transform it before
preview or delivery. Transformation is deterministic, executes no model code, and
requires no additional model call. All three options are disabled by default
at the package API level.

## Documentation

- [Overview and architecture](./docs/overview.md): responsibilities, generation
  modes, and the end-to-end pipeline.
- [Artifacts and validation](./docs/artifact-guide.md): extraction, normalization, validation, Template,
  ScriptReuse, StylePreset, and fragment transformation.
- [System prompts](./docs/system-prompts.md): prompt options and runtime
  constraints.

Use the [GenUI Playground](https://lynx-stack.dev/genui/#/lynx-xml) to generate and preview
Lynx XML artifacts.
