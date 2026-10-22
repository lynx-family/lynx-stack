# Overview and architecture

Lynx XML generates a complete `.lynxml` file containing the code and styles
needed to render a Vanilla Lynx page. `@lynx-js/genui/lynx-xml` supplies the
generation contract and deterministic processing utilities; the consuming
application supplies the model and runtime.

## Where Lynx XML fits

A2UI and OpenUI describe UI as data interpreted by trusted components in a
ReactLynx application. Lynx XML generates standalone executable UI source. Use
it when a task needs a complete page artifact with model-authored state and
interactions, and your host can load `.lynxml` files.

There is no Catalog or Library to register. The contract comes from the system
prompt, the selected transformation features, and the target Lynx runtime.

## Responsibilities

| Layer                   | Responsibility                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Prompt builder          | Describe artifact boundaries, Element PAPI, lifecycle, layout, and selected generation features.        |
| Model integration       | Supply the system prompt and user request; own providers, credentials, cancellation, and streaming.     |
| Artifact transformation | Extract complete model source and apply enabled Template, ScriptReuse, and StylePreset transformations. |
| Artifact processing     | Extract and normalize the final artifact, then validate its structure.                                  |
| Lynx runtime            | Execute the generated script and render the page.                                                       |
| Application             | Store original output and final artifacts; manage previews, failures, and any repair flow.              |

## Processing pipeline

```text
User request + buildLynxXmlSystemPrompt(options)
  → Model integration
  → Complete model response
  → assembleLynxXmlArtifact(response, options) when features are enabled
  → normalizeLynxXmlArtifact(finalSource)
  → Standalone .lynxml artifact
  → Lynx XML renderer
```

Keep raw streaming deltas available for generation progress. Run transformation on
the complete response before preview or delivery. For Direct mode with all
transformation features disabled, normalize the model response directly.

Transformation runs locally without executing generated JavaScript or making another
model request. It performs syntax and contract checks required by enabled
features. Normalization checks the final artifact contract; execution and
rendering remain runtime responsibilities.

## Generation modes

| Mode             | Model output                                                       | Consumer action                                              |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Direct (default) | Complete `.lynxml` artifact with model-authored Element PAPI code. | Normalize and validate, then render.                         |
| Template         | Intermediate artifact with one initial-tree `<template>`.          | Transform the template, normalize and validate, then render. |

Template transforms the static element tree deterministically. State and
interactions remain model-authored. Without ScriptReuse, the model also owns
lifecycle registration.

The generated contract targets the main thread: page state, UI interactions,
and lifecycle callbacks live in one `<script thread="main">`. Prompts omit
background execution and cross-thread instructions. This generation policy
does not change existing parser or renderer support for background scripts.

## Independent transformation features

| Feature     | Option                     | Responsibility moved from model output to transformation                                                |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Template    | `enableHtmlFragment: true` | Transform the initial XML element tree into Element PAPI JavaScript.                                    |
| ScriptReuse | `enableScriptReuse: true`  | Transform business callbacks into a complete script with shared page, lifecycle, event, and UI helpers. |
| StylePreset | `stylePreset: 'default'`   | Transform built-in utility-class references into self-contained CSS.                                    |

All three features are independently opt-in in the package API. Prompt and
transformation must use matching values. Template and ScriptReuse artifacts contain
an intermediate contract and must be transformed before runtime delivery.

GenUI Create and new Lynx XML Bench groups enable these features by default.
Saved product settings and historical compatibility are described in the
[artifact guide](./artifact-guide.md). Design guidance is composed separately
by GenUI Server and is not a transformation feature of this package.

## Validation boundary

`normalizeLynxXmlArtifact` is the public entry point for extracting, normalizing,
and checking the final artifact. Callers do not need a separate extraction step.
Its checks do not establish JavaScript, CSS, Element PAPI, or rendering
correctness. Use runtime previews for those checks.

Continue with [Artifacts and validation](./artifact-guide.md),
[System prompts](./system-prompts.md), or the [Introduction](../README.md).
