---
applyTo: "packages/genui/lynx-xml/**,packages/genui/server/agent/lynx-xml/**,packages/genui/server/service/lynx-xml/**"
---

Keep provider-neutral prompts and deterministic fragment compilation in
`packages/genui/lynx-xml`; keep model providers, Agent wiring, streaming, and
request options in GenUI Server.

Keep `stylePreset` opt-in and consistent across prompt construction, fragment
conversion, Agent cache keys, and Bench repairs. StylePreset uses `default`
for the built-in Lynx utility vocabulary: inject only referenced
rules before authored CSS in a single `<style>` block at runtime (TemplateBundle
rejects duplicate style sections), preserve original model output, and never
execute scripts or fetch stylesheets during conversion.
Template and StylePreset are independent: preset-only requests scan literal
classes in direct Element PAPI scripts with `applyLynxXmlStylePreset`, preserve
those scripts unchanged, and do not require a template or createFragment call.
Test all four combinations across prompts, compilation, requests, and caching.

`enableHtmlFragment` defaults to false and selects both the prompt and Agent
cache variant. Off generates a complete Element PAPI document directly. On
produces one intermediate document containing one `<template>` directly inside
`<lynx>`, alongside CSS and main/background scripts. Accept source blocks in
any order and skip raw scripts, styles, and comments when locating the template.
Require ids only on nodes referenced by handlers, updates, or cleanup; static
nodes do not need ids. After model generation,
compile the fragment, remove the template, and inject `createFragment(page,
pageId)`. This helper appends the initial tree and returns an XML-id-to-node map;
reuse one temporary element reference and a parent stack while building the
tree, and retain only explicitly identified nodes in the returned node map.
The model stores that map at main-thread script scope for later handlers. Do
not generate a separate nodeN variable for each element. Do not register a conversion
tool, retain a placeholder registry, or request another model round on success.
Keep failures explicit; Bench owns configured repairs and raw generation stays
single-call. The ordinary Lynx XML streaming service uses bounded shared recovery
for invalid token-limited output: one exact-boundary continuation when possible,
then compact regeneration, with at most three generation attempts in total.
Never trim a partial source before continuation or invent closing syntax. Preserve
the selected model, per-call output budget, cancellation, and tool scope.

Preserve the exact assembled intermediate model response in `metadata.modelOutput` and
the successful original fragment in `metadata.xmlFragment`. Off omits the
fragment metadata. Stream model text as source evidence, but preview and Judge
only the compiled final document. Preserve usage and finish reason when
postprocessing fails. Buffer continuation/regeneration responses, emit the final
validated document through `done`, and include aggregated usage and
`metadata.generationAttempts` when recovery ran. Test real Mastra generation and streaming,
including truncated and empty token-limited responses,
cache separation, and fragment handlers through render, tap, update, and cleanup.

Use the pinned `@lynx-js/skill-vanilla-lynx` dependency for shared document,
Element PAPI, lifecycle, event, background, and style guidance. Select and
sanitize Markdown in `src/vanilla-lynx-skill.ts`, import with `?raw`, and inline
it through Rslib and Rstest. Do not duplicate shared guidance or add runtime
filesystem reads, Rspeedy, external bundles, or a required `globalThis.processData`
contract. Keep local prompt overrides deterministic and tested.

When removing fenced examples from imported skill guidance, preserve the content
of `text` fences as plain text. These blocks contain normative allowed and
forbidden CSS property lists, not code examples. Test that both complete lists
survive in the assembled prompt with Template and StylePreset on and off; do not
duplicate the shared lists in local prompt source.

Keep fragment parsing bounded by length and nesting depth. Preserve source
order, XML entities and nonempty text whitespace, reject duplicate ids and
unsupported source elements, and never execute model JavaScript on the server.
Compile explicit `raw-text` leaves with `__CreateRawText`, preserving XML entities
and deliberate whitespace; accept text content or the `text` attribute, and
reject nested elements or ambiguous simultaneous text sources.
Keep `eslint-scope` external in the intermediate library build; bundle it once
in the consuming server to avoid duplicated CommonJS module tables.

Keep shared product and mobile design intent in `packages/genui/server/design/design-guidance.ts`
and concrete Lynx APIs in `src/prompt.ts`. Require applied classes with explicit `display: flex` and
`flex-direction` on layout containers. Both `__AppendElement` arguments must
be nodes; reserve `pageId` for page-owned creation APIs. For long content, append
one definite-height vertical scroll view directly to Page, without a business
view wrapper. Keep Page visually unstyled, consume host-provided safe-area
insets once, reserve fixed-bar space, specify image dimensions, and provide
legible text and 44px touch targets. Use supported literal CSS values and Lynx
accessibility attributes; do not import Web-only layout, ARIA, CSS variables,
or `env(safe-area-inset-*)`. User design systems may override visual defaults,
not runtime contracts.

Keep the local adaptation contract explicit about JavaScript lexical scope in
both direct and fragment modes. Render helpers receive parent nodes and other
render-local dependencies as parameters; call/apply/bind do not make caller-local
variables visible. State and node references shared with event, update, and
cleanup handlers must be declared in their shared scope and initialized before
use. Prompt checks reduce generation mistakes; they do not establish runtime
validity or replace artifact validation.
