---
applyTo: "packages/genui/server/**,packages/genui/playground/**,packages/genui/openui/src/openui-prompt/**"
---

OpenUI Create uses the shared text route's line delta framing. Preserve newline bytes, combine upstream token fragments, emit each complete line immediately, and flush the final unterminated line before finalization. Keep model events and cancellation independent of this buffer. Show each bounded stream delta as its own Raw output entry in the shared Agent interaction timeline, preserving reception order and per-chunk arrival time, and include retained chunks in Copy details.

Keep image-source guidance active even when search and image generation are unavailable. Do not teach fabricated media URLs in default OpenUI examples. Validate resolved Image sources, including state variables and Query defaults, against user/host inputs and the current request's image-tool results. Withhold unauthorized or incomplete image sources during streaming and retain usage when final validation fails. Reuse the capability RequestContext for validation; never authorize an image just because its URL uses HTTPS or appears in assistant history.

When the Playground development payload store is enabled, publish conversation shares through its existing same-origin store. Development payloads expire after thirty minutes and on server restart; do not persist their URLs as durable share-cache entries. Production shares continue through GenUI Server storage. Display publication errors separately from clipboard failures.

OpenUI component arguments follow the ordered schema, including optional alias slots. Teach `null` placeholders for skipped middle arguments in both full and reduced-vocabulary prompts. For List, preserve `children, items, direction, align, gap, divider`; a children-based layout call must retain the second items slot as `null`. Validate documented positional examples against both the headless prompt and renderer libraries rather than relaxing enum validation or guessing shifted values at runtime.

Keep closed enum guidance in the shared `ENUM_ARGUMENT_RULE` used by both full and reduced OpenUI prompts, and align the distributed skill reference with that rule. Component descriptions should describe their purpose rather than repeat enum constraints or accumulate prohibitions for individual generation errors. Keep schemas as the source of allowed values, and preserve strict parser validation rather than silently coercing invalid enum values.

For interactive OpenUI Create, keep mutable business content in Query results
and use Action/Mutation followed by Query refresh for data-only interactions.
The shared OpenUI prompt library includes data tool guidance only when
`promptOptions.tools` declares both `openui_query` and `openui_mutation` and
Query/Mutation tool calls are enabled; Bench disables these tool calls.
Playground declares its registered runtime tool names in the stream request
`tools` field; the route validates and forwards them to promptOptions.tools.
These names do not register server-side model tools.
Maintain these rules in `packages/genui/openui/src/data-tools/data-rules.ts`;
`openui-prompt` imports them when the required tools are declared. The Create host supplies `openui_query` and `openui_mutation` as
deterministic local-storage tools. Keep generated business data only in DSL Query defaults;
do not copy it into server metadata, live payloads, history or shares. The renderer
reports complete Query defaults through onParseResult; reuse that parse result
rather than parsing DSL before first paint or on every tool call. Before delivering
an existing artifact to the renderer, restore local values through the existing
`initialQueryResults` input, preserving explicit host prefetches for other keys.
Merge at the Query statement-name level with saved local values taking priority;
preserve falsy results and empty arrays rather than merging array contents.
Carry these results through every renderer initialization branch, including
live streaming, retaining them for the first stable render.
Initialize the local host with renderer-collected defaults through
OPENUI_DATA_TOOL, reusing registrations while the source and defaults are unchanged. Query/Mutation calls wait for this initialization independently
of rendering and cancel pending waits on source changes or unmount. Forward defaults
to the inspector only through the current preview frame and navigation token.
Keep inspector parsing lazy and bounded by source; reuse one fallback parse for
JSON and Query data when no renderer result is available.
Subsequent local tool requests carry source and operation arguments, not a duplicate data map;
restored results must never become new defaults after local storage is cleared. Mutations declare `{ key, value }`, with a complete replacement computed by existing OpenUI expressions, and execute
through `OPENUI_DATA_TOOL` in the local host, never through the model, stream
endpoint or conversation history. `@ToAssistant` uses ordinary conversation
requests to generate new DSL; keep this separate from local data tool execution.
Clone and validate the JSON value before replacing the Query result and persisting; surface storage errors without
claiming success. The browser adapter uses localStorage, namespaced by the exact
DSL source identity (with the source checked on reads); reopening the same
artifact restores local data and different source text has independent data.
Native hosts must provide the same local adapter; never fall back to the LLM.
Keep Query data as the original Query defaults in the Create inspector.
Local data reads the same effective initial-plus-stored data as the Query tool
and subscribes to same-origin preview iframe storage changes, including removal
and clear. Keep this subscription inside the artifact viewer so inspecting local
edits never changes conversation output or reloads the preview. Surface invalid
storage as an inspector error without silently overwriting it.
Derive list counts from Query arrays rather than maintaining redundant counters.
Keep the core `useOpenUIState` Query and Action flow unchanged. Restore local
data in the host through `initialQueryResults`; Query defaults and prefetched
results participate in the first synchronous render after streaming completes.
Validate transport and storage objects at their consuming boundaries; keep these
small shape checks local instead of introducing a shared generic data reader.

Keep loop-dependent components and selection actions inline in `@Each`;
separately assigned row components do not inherit its loop scope. Teach this
with invalid named-row and valid inline-row examples, including row-local Action
IDs. Passing a state variable as a component value does not create a write-back
binding: ChoicePicker keeps selection locally, so filters must use explicit
`@Set` actions or a component's supported state binding.
OpenUI does not support user-defined row functions. Bind TextField names to
their `$state` keys. With the unchanged core Action flow, mutations read the
state snapshot that created the action. Select a row in one action, then save,
toggle or delete it in a separate editor action; never teach `@Set` followed by
a mutation consuming the new state in the same action. Compare selection IDs
to their empty sentinel because inserted IDs may be strings. Validate dynamic
list examples by evaluating row text and actions, not just parsing the DSL.

Keep reusable Query default extraction and deterministic persistence operations in
`@lynx-js/genui/openui/data-tools`. Consume an existing ParseResult with getQueryDefaults;
for incomplete results, supply the original source to exclude auto-closed trailing
Queries. This entry must remain independent of the renderer, component catalogs,
DOM and native globals. Inject synchronous scoped storage into
createQueryDataStore. Keep Playground source hashing, storage encoding,
bridge messages and storage-event subscriptions in the host adapter. Reuse
InitialQueryResults for restoration and preserve the renderer's existing Query
and Action flow. Storage adapters must atomically replace a scope or throw;
reads never persist defaults and mutations must not modify previously read data.

Keep OpenUI conversation content and preview source as plain DSL. Do not wrap
rawText and initialQueryResults in a JSON string or restore this obsolete format.
Only host render inputs carry initialQueryResults; generated outputs, model
history, conversation persistence and shares must not contain a separate data map.

Keep Playground inspection in `src/openui/inspector.ts`: lazy parsing and
cached display data for JSON, Query data and Local data tabs. Keep browser
storage and local tool adaptation in `src/openui/dataHost.ts`, delegating
query/mutation semantics to the shared data API. Do not feed inspector JSON
back into the renderer or use inspector parsing to execute data operations.

Group Playground OpenUI inspection and local data host modules under
`src/openui/`, with tests next to their implementation. Keep the reactive Local
data artifact view in `localDataView.ts` and use the same snapshot for static
text and subscriptions. Import host and inspector modules directly so the render
host does not pull in inspector parsing. Protocol adapters remain in their
existing `pages/chat/` and `render/` entry points.

Use createQueryDataTools from `@lynx-js/genui/openui/data-tools` for data tool
registration, merged default initialization, bounded initialization waits and
scope lifecycle checks. Its injected call returns operation values and rejects
failures; keep bridge response envelopes and message names in the Playground
adapter. Select scope explicitly and publish defaults from existing parse results.
Changing scope or disposing rejects pending calls without aborting dispatched
host operations, so adapters must honor request scope and own transport timeouts.

Query assignment names and tool resource keys are separate identifiers. Playground's
dataTools adapter derives their association from completed renderer parse results,
then translates Query and Mutation keys to statement IDs before host execution.
Persist and restore results by statement ID for initialQueryResults. Clear these
associations on scope changes and reject ambiguous keys; never infer an alias from
the only default or parse source again inside a tool call.

Local Mutation tools persist complete values without an op interpreter or field merging. Reuse arithmetic, `@Each` and `@Filter` for transformations; keep `@Set` and `@Reset` scoped to UI state. Do not introduce array append syntax or ID generation that the language does not support.

Keep the Todo List example's seed items in its DSL Query defaults. Use only the
shared data tools for persistence and initialQueryResults restoration; do not add
a separate Todo store or Todo-specific tool provider. Express updates with
supported DSL operations and keep application-specific logic out of the host.
