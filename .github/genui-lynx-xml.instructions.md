---
applyTo: "packages/genui/lynx-xml/**,packages/genui/server/agent/lynx-xml/**,packages/genui/server/service/lynx-xml/**"
---

Keep Lynx XML prompt construction in `packages/genui/lynx-xml`; the server
agent should consume the package and contain only provider and Agent wiring.
Use the pinned direct `@lynx-js/skill-vanilla-lynx` dependency as the source of
shared `.lynxml` document, Element PAPI, lifecycle, event-routing, background,
and styling guidance.
Select and sanitize its Markdown in `src/vanilla-lynx-skill.ts`, import it with
`?raw`, and inline it at build time. Do not duplicate that guidance in the local
prompt or add runtime filesystem reads. In particular, select the document
contract and assembly sections from `references/lynxml.md` instead of repeating
the XML envelope or source-block shape in `src/prompt.ts`; keep only
GenUI-specific parameters and adaptation overrides there. Keep the dependency
bundled in Rslib and in Rstest's `output.bundleDependencies` so the raw-asset
rule processes its Markdown. Adapting the skill must not introduce Rspeedy,
external bundles, or a required `globalThis.processData` contract into the
self-contained `.lynxml` prompt without an explicit product decision.
Require the page root and every container that lays out Element children to
apply a class with explicit `display: flex` and `flex-direction`; generated XML
must not rely on Lynx's default Linear layout.
Keep numeric component ids separate from Element PAPI node references. Both
arguments to `__AppendElement` must be nodes, append helpers must receive the
parent node rather than its id, and `pageId` is reserved for page-owned element
creation APIs.
Keep XML fragment parsing and deterministic Element PAPI generation in
`packages/genui/lynx-xml` and export those headless utilities from its package
entry point. Keep the server's `html_fragment_to_main_thread_script` module
limited to Mastra tool and request-scope wiring. Parse well-formed fragments in
source order, emit Element PAPI creation, literal property, and append calls
that assume `page` and `pageId` already exist, and leave state, event handlers,
updates, lifecycle registration, cleanup, and CSS to the agent-authored
artifact.
Bound element nesting before recursive emission, ignore whitespace-only text
nodes, and preserve the original text of every non-empty node. Cover both
limits with converter regression tests.
Keep generated fragment JavaScript in a Mastra `RequestContext` registry scoped
to one agent run. Return only an opaque placeholder plus XML-id node bindings to
the model, require the placeholder exactly once on its own line, and expand it
before final artifact validation and delivery. Never store generated scripts on
the cached Agent or in a process-global registry.
Maintain mobile-specific defaults in `src/mobile-design.ts`: start from a
narrow portrait, single-primary-scroll layout; use responsive units and a
consistent semantic palette; consume each safe-area edge once; reserve space
for fixed bars; and require legible type and touch targets of at least 44px by
44px. Safe-area values must come from explicit host or initialization data, be
converted to Lynx-supported lengths, and be consumed once; never emit Web CSS
`env(safe-area-inset-*)`. Keep this guidance compatible with the imported
strict `.lynxml` style contract: resolve the palette into reusable classes with
supported literal values instead of CSS variables, and require explicit width
and height for bitmap media. When content can exceed one viewport, make the
definite-height vertical scroll view the first business node directly below the
Page and do not wrap it in another business view. Keep concrete Element PAPI,
scroll-view, image, and accessibility attributes in `src/prompt.ts`;
`src/mobile-design.ts` should contain only provider-neutral mobile design
intent. Tappable controls use Lynx `accessibility-element` and applicable
`accessibility-traits`; add an `accessibility-label` when visible text does not
already name the control, and never use Web `aria-label`. Explicit user design
systems may override visual defaults, but not Lynx layout, safe-area, runtime,
or accessibility contracts.
Web mobile-design guidance may inform provider-neutral hierarchy, contrast,
form feedback, UI state, and purposeful-motion principles. Do not copy Web-only
mechanisms or metrics such as semantic HTML, ARIA, media or container queries,
`clamp()`, `srcset`, `prefers-reduced-motion`, or Core Web Vitals into
`src/mobile-design.ts`; express the underlying intent in terms that can be
implemented with the supported Lynx runtime and style contract.
Keep prompt construction deterministic and cover configurable fields and core
dependency-derived and local override invariants with package tests. Verify the
built output has no runtime Markdown imports. Include the package config in the
root Rstest project list and validate it with `pnpm exec rstest run -c
rstest.config.ts --project genui/lynx-xml`.

Keep the original successful `html_fragment_to_main_thread_script` input in the
same per-run RequestContext as its generated script. Return only that original
string to clients as `metadata.xmlFragment` alongside the final `text`, including
in the SSE `done` event; omit `xmlFragment` when no conversion ran. Preserve whitespace
and XML entities exactly, keep generated-script registry details out of metadata,
and keep the model-visible tool result limited to bindings and
the placeholder. Also expose the exact final model text as `metadata.modelOutput`
before placeholder expansion, declaration insertion, binding repair, or envelope
normalization. Include it even when no fragment conversion ran, using accumulated
text deltas only when the provider does not return final text. The shared text-stream route may forward optional result metadata
without depending on Lynx XML types or mixing it into text deltas.

When the server inserts generated fragment code inside `renderPage()`, request
script-scoped node generation. Keep node assignments at the placeholder and add
one combined `var node0, node1, ...;` declaration outside the function at the
start of the main-thread script, after any directive prologue. Preserve directive
semantics, including automatic semicolons, and support eager rendering; ordinary converter calls keep local
`const` declarations by default. Returned bindings must work from external event,
update, and destroy handlers after rendering. Cover this by executing an assembled
script with deterministic Element PAPI mocks, including re-render and node13 access.

XML ids do not declare JavaScript variables. Tell the model to use binding-map
values in every handler and update, and that the placeholder already appends the
fragment roots. At final assembly, resolve undeclared XML-id references against
the per-run bindings using JavaScript parsing and lexical scope analysis in the
headless Lynx XML package. Preserve declared aliases, local bindings, property
keys, strings, comments, and shorthand keys. Reject rewrites captured by a local
nodeN binding. Do not create globals for arbitrary XML ids or rewrite identifiers
with a text regex. Cover initial updates and tap-driven updates with executable,
model-free weather regressions.

Keep `eslint-scope` external in the intermediate Lynx XML ESM build; the GenUI
server bundles it and its CommonJS dependencies once in the final executable.
Embedding that runtime in the library and bundling it again can overwrite the
server's module table. Validate dependency and bundling changes by starting the
built server on an ephemeral local port and requesting a model-free route,
in addition to source-level converter tests.
