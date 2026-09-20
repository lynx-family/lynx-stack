---
applyTo: "packages/genui/playground/**"
---

# GenUI Playground

## Runtime Boundaries

### Web and Native Host APIs

When sharing GenUI playground code between web preview and native Lynx execution paths, do not use bare `window` access in code that may run in Lynx. Read web-only capabilities through optional `globalThis` host adapters, and pass native preview data through `globalProps` or bridge fields rather than relying on browser globals.

When runtime code needs to distinguish Lynx for Web from native Lynx, prefer `SystemInfo.platform === 'web'` over `typeof window !== 'undefined'`. Native Lynx environments may expose browser-like globals, while Web Core explicitly sets `SystemInfo.platform` to `web`.

Keep `transform-vw` and `transform-vh` enabled on every Web `<lynx-view>` used for playground previews, including both the bundled-protocol render entry and the direct Lynx XML preview. Set the attributes before assigning the preview URL so Web Core decodes viewport units relative to the preview LynxView container rather than the browser window.

### Playback Synchronization

Forward OpenUI renderer diagnostics through `NativeModules.bridge.call('OPENUI_RENDER_ERRORS', { errors }, callback)`, including an empty array to clear old errors. Keep the structured source, code, statement, component, path, tool, and hint fields for host consumers. The Web render entry must attach its preview navigation token; the receiving panel must check origin, its own iframe window and URL, and the token before displaying errors. Clear diagnostics when the source changes, and keep transient streaming errors behind the renderer's existing completion gate.

When wiring playback state between the Lynx app and the web preview, prefer `NativeModules.bridge.call('A2UI_PLAYBACK_SYNC', state, callback)` on the Lynx side and `lynxView.onNativeModulesCall` on the web preview side. Keep `window.postMessage` only as a compatibility fallback for older bundles. Do not add new playback sync paths that bypass the NativeModules bridge.

When automating A2UI preview benchmarks, wrap `render.html` in a parent iframe with a `previewMetricId`, listen for `A2UI_PREVIEW_METRIC` in the parent, and inject generated messages with `A2UI_LIVE_MESSAGES` after `A2UI_RENDER_READY`. Loading generated messages only through the initial query payload can capture FCP/FMP/TTI, but it does not exercise the Create page's live-delivery path that reports the repeatable Render metric.

Treat Bench as a protocol-neutral, English-only page in the regular GenUI top-level navigation; do not replace the GenUI application chrome with a standalone Bench shell or expose a language control. Until site-wide localization is introduced, keep `BenchPage` free of page-local locale props, translation helpers, and bilingual system labels. Use `#/bench` as its canonical route, keep old Bench hashes as compatibility inputs to the same combined page, and do not expose Runner, History, Phase 1, Phase 2, or other Bench subviews in the UI. This route guidance does not apply to the A2UI server API paths under `/a2ui/bench/jobs`. Follow Create's interaction model with an inline New Bench action and a persistent history rail: New Bench must immediately prepend and select a persisted draft item, completing that draft must update the same item, and earlier items must not be overwritten or evicted. Restore completed history entries as read-only and require New Bench before another run. Structure Runner as a single workflow surface with three internally separated `benchPlanSection` steps: show its three editable default scenarios first and allow custom scenarios to be appended, then let users create comparison groups explicitly in Protocol, Model, or Prompt directions, then show Provider, UI Judge, and run parameters inline. Keep the three-step configuration in its own scroll container and reserve a compact, non-scrolling footer for the live plan summary and run action. Once a job starts, replace that footer summary with the real-time progress message and progress bar so execution remains observable while the configuration scrolls. Label the primary action Start run while idle, complete, cancelled, or failed, and change it to Pause only while a job is active. Disable Start run when Protocol, Groups, Scenarios, or Runs is empty. Do not show potentially stale comparison-group, scenario, or run-count badges beside the Bench page title; the compact footer summary owns those values. Keep `pages/bench/BenchPage.tsx` focused on cross-section state, persistence, and server-job orchestration; keep static defaults and pure derived state in `pages/bench/benchData.ts`, and keep section-specific calculations in the corresponding component. Reuse shared `Button`, `Icon`, `PageHeader`, and `PanelResizeHandle` primitives instead of duplicating their structure or accessibility behavior.

### Native Test Bundles

When serving the playground's native Lynx bundles as static Android test fixtures, keep HMR/React refresh out of `a2ui.lynx.js` and `openui.lynx.js`. The Android Lynx runtime does not provide globals such as `__prefresh_utils__` or Node's `process`, so normalize `process.env.NODE_ENV` at build time and disable HMR for these bundles instead of relying on the caller's `NODE_ENV`.

## Chat Page Architecture

Display Create's Generation duration from the server's finite, non-negative `metrics.generationMs`, consuming A2UI's pre-upload `metrics` event and terminal `done`/`error` payloads in the shared controller. Persist it on the assistant turn and restore it independently of render metrics. Never substitute browser request-to-response time or summed Jev call durations. Keep legacy `agentOutputMs` distinct and do not relabel old values as generation time. Reset timing for every Create/action invocation; missing server timing stays unavailable. Verify that early metric delivery, upload completion and history restoration preserve the existing preview instance.

Keep Create's provider selectors in separate labeled controls with a wrapping options row below them; size this layout to its resizable composer instead of a fixed-width enclosing pill. Keep Design, Template, and StylePreset independent. All three default on for new Lynx XML records; Template must not disable or reset StylePreset.

Use Template and StylePreset consistently in Create, Bench, and reports. Template
is the user-facing name for the existing `enableHtmlFragment` option; explain
that it converts `<template>` markup to Element PAPI at runtime.

Use the build-time `GENUI_SERVER_URL` environment variable as the single
default GenUI server origin for Chat, Bench, health checks, and preview payload
publishing. Keep its fallback at `http://localhost:3060`, validate it as a
credential-free HTTPS origin in the playground build configuration, allowing
HTTP only for loopback development, and do not reintroduce separate
hosted-server constants in individual frontend modules. URL query endpoint
overrides may remain available for diagnosis only for server-owned model
requests. When a request carries a custom API key, ignore endpoint overrides,
require the request target to match the configured GenUI server origin, and
disable redirect following so credentials cannot move to another origin.

Load Create-tab and Bench server-owned model choices from the GenUI server's `GET /models` endpoint. Reuse the shared provider settings adapter semantics in both surfaces: also provide a custom-provider control with model and API key fields plus a fixed selector containing the server-approved OpenAI-compatible base URLs; do not accept an arbitrary custom-provider URL in the playground. Store each endpoint's default model in the same option mapping and replace the model field with that default whenever the endpoint changes. When the endpoint reports that `GENUI_MODEL_CONFIG_JSON` is absent, select that custom provider instead of blocking Create or Bench. Persist only the non-sensitive provider selection in browser local storage. Keep model, API key, and base URL only in current-page memory so they survive protocol switches; after a refresh, clear the API key and restore the built-in model and base URL defaults. Never restore custom-provider fields left by older persisted formats so the next settings write removes them. Keep the API key input visually masked. Send custom provider values only in model request bodies, and continue sending only the public model name for ordinary server-owned selections. Bench comparison-group model controls must use the loaded server model list for server-owned providers and allow free-form model ids only with a complete custom provider.

Expose `UI_JUDGE_SERVER_URL` in Bench's inline run configuration as a client-side setting, saved locally and included in shared parameter links. Accept only credential-free HTTP(S) URLs and persist the normalized value in local storage. Require it when UI Judge is enabled for a non-HTML group; never send it to GenUI Server or fall back to a server environment variable. Check `/health` directly from the browser before starting the job. Consume screenshot task IDs from Bench SSE, fetch capture fields from GenUI, POST multipart directly to `/screenshot/template` or `/screenshot/lynxml`, then upload raw BMP or a capture error to GenUI for scoring. Deduplicate replayed task IDs, bound image bytes and timeouts, and cancel browser work when the job ends or the page disconnects. Cross-origin screenshot deployments must allow the Playground origin through CORS and browser network policies; do not work around this with a GenUI proxy.

Keep completed Bench history plans non-editable without making their content inert. Use read-only text fields and disable only controls that mutate state, while preserving text selection, copying, scrolling, and disclosure controls throughout the historical plan.

Show the Bench footer's shared horizontal PanelResizeHandle only while its workflow is expanded. Dragging upward increases the footer height; clamp it to leave space for the plan, recompute limits when its parent resizes, and stretch the workflow into the remaining row with independent scrolling. Keep summary and run controls visible, retain the chosen height across disclosure toggles, support keyboard resizing and read-only history, and clean up pointer listeners and document styles when resizing ends or the footer unmounts.

Keep FMP, TTI, and Render columns and their explanatory placeholders out of Bench report views. Preserve stored measurements for backward compatibility.

Allow draft and completed Bench history entries to be renamed inline from the history rail. Save a trimmed, non-empty title on Enter or blur, cancel on Escape, and ignore Enter during IME composition. Persist names through the existing history write queue without changing report data or plan settings. Preserve explicitly edited titles when a draft completes or a report is refreshed; default draft titles may still become generated run summaries.

Keep automatically generated Bench group names synchronized with their preset's comparison variable when protocol, model, or catalog changes, including model reconciliation after provider loading. Preserve manually edited names and the group's identity. Store the updated name in the plan so the editor, submitted job, history, and workflow use the same value. Generate model and catalog preset IDs from their preset and index, independently of the selected values.

Expose custom-provider completeness through the shared settings adapter validation hook. Disable Create submission and reject preview action requests when Custom API key lacks either a non-empty model or API key, and enforce the same invariant while building provider request options so alternate call paths cannot send incomplete credentials.

Scope provider endpoint choices through the shared settings adapter factory. A2UI Create additionally offers TypeSafe Jev at `https://api.typesafe.ai/v1` with default model `jev-latest`; other Create protocols and Bench must not offer this evaluation provider. Pass A2UI capability to both generation and action request builders. Preserve masked credentials, page-memory-only custom fields, unchanged demo prompts and the shared Design control. Do not add a provider-specific form or duplicate the shared settings implementation.

Render Create's Design, Template, and StylePreset controls as compact checkboxes that wrap in narrow composers. Save their explicit values to the current draft on edits and before generation; restore them when selecting or reloading history, including failed or unsent records. Once a conversation has messages, render these options read-only and reject checkbox updates; changing them requires a new conversation. Unsent drafts remain editable. New Lynx XML records start with all three enabled instead of inheriting another record's values or global checkbox preferences. Prevent asynchronous model loading from overwriting restored or edited values, and keep credentials out of conversation settings. New Lynx XML Bench groups also default all three options on; preserve recorded values in plans, shared links, and reports, including StylePreset-only configurations. Keep API defaults separate from UI defaults.

Route all protocol Create tabs through `pages/chat/ChatPage.tsx`. Keep all shared React state, effects, conversation operations, provider controls, usage and preview metrics, streaming transport, examples, actions, and rendering orchestration in `pages/chat/ChatController.tsx`. Keep the shared conversation list, header, transcript/composer slots, resizable preview, delete confirmation, copy toast, and mobile tabs in `pages/chat/ChatWorkspace.tsx`, with styles in `pages/chat/ChatPage.css`.

Render every protocol's generation summary and interaction disclosure through `pages/chat/ChatAgentInteraction.tsx`. Match A2UI Create's assistant card for pending/error states and compact status row for completed states. Choose this presentation from the message tone, independently of protocol-specific message kinds, so tool-result headers cannot change the summary typography, spacing, or border. Keep this component presentational; collect and update interaction logs in the shared controller.

Show artifact sizes in tokens across every Create protocol using the shared lazy `o200k_base` source counter. Count the currently displayed view's exact text, including whitespace, and update when switching Original/Transformed, Raw/JSON, or formatting. For JSON transcript outputs, count the same serialized payload used by Copy all. Keep these source sizes distinct from provider-reported API usage, and remove character counts from Create status and progress text. Reuse the same counting hook in Examples.

Keep `pages/chat/a2ui.ts`, `pages/chat/openui.ts`, `pages/chat/mcp-apps.ts`, `pages/chat/lynx-xml.ts`, and `pages/chat/html.ts` as hook-free, JSX-free protocol adapters. They may define protocol request bodies, stream reducers, history conversion, persistence payloads, artifacts, examples, preview sources, and action conversion, but must not duplicate the controller's React state or host-side effects. Whole-document adapters should expose cumulative partial source as a live artifact while reserving reload-based preview delivery for a complete document.

Make each Create generation status a collapsed disclosure of its actual request and response events. Collect the trace in the shared controller transport, preserve its message identity and details through progress, success, and failure, and keep it scoped to that invocation. Keep protocol messages in the default timeline as short summaries of the operation, surface, component/loading counts with a bounded list of distinct component names, or data path; do not retain component definitions or data values in these entries. Bound the number of summaries per batch and indicate additional messages. Combine all text deltas, including those interleaved with messages, into one Raw output summary showing chunk count and elapsed time. Apply this summary-only presentation to every protocol without adapter-specific notices or options. Display and copy complete content only from generated output cards or the artifact viewer, not from interaction details. Store only completion status, finish reason, and validation summaries in done/JSON log entries; retain token usage once through the usage emission. Copy details exports the compact timeline. Bound event retention and payload previews, preserve the raw output independently of timeline eviction, and show event truncation explicitly. Keep the full response untouched for protocol reduction and final output processing. Select request metadata without copying provider credentials, headers, or endpoint query parameters. Keep these diagnostic traces in page memory, outside persisted/shared conversation history and model inputs.

For MCP Apps tool turns, show the model's tool selection and the host-executed tool result as separate JSON transcript entries. Build those entries through the same pure helper for live success and history hydration so reopened conversations preserve the Tool Call/Tool Result sequence.

Keep `lynx-src/mcp-apps` unaware of MCP Apps protocol details. Define renderer inputs and local APIs there, and perform MCP registry construction, `ui://` mapping, and the initial JSON-RPC tool selection in the chat adapter.

Import MCP Apps Lynx host components, renderer definitions, and registries through `@lynx-js/genui/mcp-apps/render`. Keep shared data contracts on the compatibility root entry and MCP protocol metadata and JSON-RPC types on the separate `@lynx-js/genui/mcp-apps/protocol` entry.

Keep MCP Apps card interactions local to the renderer. Refresh, purchase, and similar card actions must call the card's sibling `api.ts` directly and update renderer-owned state; do not relay them through `NativeModules`, `window.postMessage`, a Chat action adapter, or the agent. Register only model-visible tools needed to create the initial card.

Use `mcpAppData` as the MCP Apps-specific preview payload field across Chat preview sources, render URLs, render-page init data, and Lynx `globalProps`. Do not expose this protocol-specific payload through a generic `appData` field.

Keep generated artifact containers aligned with completed status messages: use the full transcript width, the same outer padding and corner radius, and a transparent background without an outer border. Share these container rules instead of adding protocol-specific width overrides. Preserve compact headers, code toolbars, protocol-specific views, and metadata inside the artifact.

Keep OpenUI, Lynx XML, and other artifact viewers on the shared generated-output styling. Reuse A2UI's code chunk border, header, and Copy button inside the artifact. Place view switches such as Raw/JSON and Original/Transformed in the code toolbar, with an accessible selected state, instead of duplicating the active view label below a separate header switch. Keep metadata in its original case and allow toolbar controls to wrap in narrow panels.

When rendering the unified `ChatPage`, key it by protocol so switching between A2UI, OpenUI, MCP Apps, Lynx XML, and HTML fully remounts the controller. This prevents in-flight requests, import guards, provider state, transcript state, and preview refs from leaking across protocols.

## Protocol-Aware Conversation Data

Treat an omitted or normalized-null cache-token count as zero only when estimating cost: charge all known input at the regular input rate and add no separate cache charge. This applies to Jev and other providers without a cache breakdown. Preserve missing counts in reported/persisted usage instead of fabricating zero cache hits. Known cache counts still split input pricing normally; missing input/output usage or prices remain unavailable, and explicit invalid counts remain invalid. Keep Create and Bench on the shared cost estimator.

Show Create token usage and estimated CNY cost inside each response's chat card, never as a single header total. Persist the normalized usage and that request's public model price snapshot on its assistant message, including reported usage on failed generations and action replies. Restore every turn independently after reload, and never reprice old responses using the currently selected model. Keep usage metadata out of model conversation inputs. Prefer canonical `tokenUsage` over raw provider usage, retain unknown counts, and calculate cost as uncached input plus cached input plus output per thousand tokens; cache writes and reasoning are already included in input and output. Custom providers and old records without saved prices have unavailable cost, not a fabricated zero. Bench reports use each run's server-saved price snapshot, show recorded-run totals and averages with the same planned-run denominator as tokens, and exclude UI Judge costs. Keep costs in saved JSON and the existing report image renderer without loading current provider prices on the standalone report page.

Keep Bench comparison-group summary chips on one line with a 160px per-item maximum, shrinking and ellipsizing text within the available card width. Preserve full labels in their title attributes. Default new Bench run settings to two repeats without replacing explicitly saved historical settings.

### Local History

Create relies on the server's single-attempt defaults without sending an additional retry switch. Show failures and their usage immediately, then offer an explicit Retry action for the latest failed turn, including after history restoration. A retry must retain the original prompt or action and surface, start only on user interaction, and keep the failed response's usage in history. Exclude failed user/assistant pairs from model context so retrying does not duplicate the prompt. Treat a negative A2UI validation result as an error even if its raw text parses as JSON.

Show the response's reasoning token count in each Create usage badge, explaining that it is included in Output. Missing reasoning counts mean Not recorded, including older history. Do not display Attempts counts or per-attempt details in Create; its default generation policy performs no automatic retries. Keep previously stored attempt metadata compatible without adding it to the aggregated response usage.

On failed Create responses, show provider-returned reasoning text in a separate Reasoning disclosure within the interaction details. Bound the text and show truncation explicitly; do not put it in the compact event timeline, Copy details, persisted/shared history, or model inputs. Omit the disclosure when the provider returned no text; reasoning token counts do not imply that text is available.

Show the saved model name directly in every Create response's usage badge, including custom model names and failed responses; never infer it from the currently selected provider. Save the provider selection with conversation generation settings before both ordinary generation and action requests. Restore available server models when reopening history, even if the model list arrives later, while keeping each turn's original model and prices. Older records without a provider and removed server models retain the current valid selection. Persist only the provider selection in conversation settings; keep custom API keys and endpoints out of history.

When adding or updating playground conversation history, keep records isolated by protocol. Store new records with `ConversationMeta.protocol`, use protocol-scoped active-id metadata such as `activeConversationId:a2ui` and `activeConversationId:openui`, and treat legacy records without a `protocol` field as A2UI conversations so existing browser history remains visible.

Treat external `updateDataModel` paths and values as untrusted when materializing conversation snapshots. Traverse only own properties and define own data properties without invoking the legacy `__proto__` setter, while preserving prototype-like names as valid JSON keys.

Rebuild A2UI `Generated Output` cards from each ordinary assistant history entry, preserving transcript order and rendering the entry's A2UI message array as separate chunks. Keep successful action responses in their action-specific Applied cards, and do not replace history-scoped output cards with a single controller-level artifact derived from the latest preview output.

When an action response is merged with the current preview messages, clear any previous or action-only snapshot payload URL and persist the merged inline preview. Treat an explicitly present `snapshotPreviewPayloadUrls: null` as a clear operation rather than falling back to `previewPayloadUrls`; otherwise reopened and shared conversations can render a stale pre-action snapshot.

### Shared Imports

Keep Bench and Create history cards compact: anchor a directly accessible share icon and a vertical-ellipsis icon at the top right beside the title, outside normal flow, and reserve only the title or rename field's end space for them. Metadata and previews retain the full content width; do not give actions a separate row. Keep sharing outside the menu; use the shared HistoryItemMenu for labeled rename, copy, and delete actions. Render the menu in a viewport-bounded portal so history scrolling cannot clip it; support keyboard navigation, Escape, outside dismissal, and focus restoration without stealing focus from inline rename. Preserve action availability and disabled states on narrow screens. Keep parameter sharing directly accessible on each Bench entry. Share that entry's saved configuration and title with the currently configured screenshot service URL, without changing the active entry. Share Bench parameters through a versioned, size-bounded `#/bench?plan=` link containing only an explicit allowlist of the title, comparison groups, scenarios, run settings, and normalized `UI_JUDGE_SERVER_URL`. Preserve Unicode, model IDs, prompts, enabled states, Design skill, Template, repair, repeats, and Judge model settings. Exclude results, screenshots, prices, job IDs, credentials, and provider endpoints. Restore a shared screenshot service URL into the receiver's form and local storage; old links without this optional field retain the local setting, while an explicit empty string clears it. Apply the same credential-free HTTP(S) validation and normalization used for run setup. Import into a new editable local draft after history hydration without replacing other entries or starting jobs; remove the payload from the address only after persistence so refresh preserves edits without duplicate drafts. Reject invalid payloads visibly without loading unrelated reports. Preserve saved model IDs through model loading and history restoration; unavailable generation or Judge models require an explicit user selection, never silently substitute a default. Only reconcile model defaults for a fresh, unsaved plan.

Default Bench report scenario, comparison-group, and run disclosures to collapsed, preserving native summary controls for manual expansion. Keep the standalone report compact with restrained heading sizes, section spacing, metric-card padding, table row padding, and screenshot thumbnails; preserve responsive grids. Render Run evidence as flat screenshot grids grouped by comparison group, with each group ordered by scenario and repeat. Keep all saved screenshots, including results whose group or scenario is absent from older plans. Do not reuse the screenshot dialog matrix or show a View screenshots action on the report page. Treat public `model` fields as display metadata, not secrets merely because an identifier is long, while continuing to redact known credentials and private URLs. For older redacted model fields, recover only from the same cached entry's matching group ID (or its own environment); never infer a model from another group, another history entry, or current provider settings.

Give every report run a Copy artifact control that remains usable while its details are collapsed. Copy saved A2UI messages as formatted JSON, falling back to saved text when messages are absent; other protocols copy their saved text without trimming or wrapping it. Use only that run's locally saved artifact, disable copying when no output was stored, preserve disclosure state on click, show per-run copy feedback, and exclude copy controls from exported images.

Keep the Bench cost explanation behind an info icon next to cost labels in both report views, instead of an always-visible paragraph. Use a keyboard-accessible, click-toggle popover that escapes table clipping, fits the viewport, and dismisses on Escape, outside click, or surrounding scroll. Exclude the icon and popover from report images while retaining cost labels and amounts.

Keep Copy Report JSON on the standalone report detail page alongside Generate share image. The Runner's right-hand report panel should offer View details instead of another JSON-copy entry, using the same new-tab opening behavior as the history rail.

Open Bench history details in a new tab with the shared document-detail icon. Keep the report URL free of payloads and preserve the selected history ID in that tab's session storage so opening another report cannot switch existing detail tabs. Generate share images locally from a clone of the existing PublishedReport DOM, removing entire run-result disclosures (including their summaries) through `data-report-image-exclude` while preserving the live page's disclosure and scroll state. Retain and expand every Recorded plan scenario and comparison-group detail, plus summary-table token breakdowns, in the export. Retain saved PNGs and measure table widths after expansion so token breakdowns are not clipped; do not maintain a second report renderer. Exclude navigation and action controls, lazy-load the rasterizer, skip unrelated web-font downloads, bound canvas dimensions, and revoke preview object URLs on close or replacement. Provide PNG preview/download and clipboard copying where supported; never upload the generated image or append it to a link.

Bench report viewing is temporarily local-only. Open the fixed read-only `#/bench/reports` page from a history entry, storing the selected entry ID in `a2ui-bench-selected-report` rather than appending report data or remote URLs to links. Read reports asynchronously from the `benchHistory` store in the shared `a2ui-playground` IndexedDB via `src/storage/benchRepo.ts`; do not publish Bench reports, fetch `benchReportUrl` parameters, load providers, or recover server jobs from the standalone report page. Legacy job-ID routes read matching local snapshots only. Missing cached records require an explicit error, not another report or archive fallback. Preserve valid inline PNG `screenshotDataUrl` fields in history and JSON exports, bypassing text redaction only for this validated field. Check PNG framing and dimensions and bound decoded image bytes to 2 MiB per image and 8 MiB per report; do not render remote, SVG, blob, or malformed sources. Show saved screenshots directly in grouped flat grids on the report page. Keep credential redaction elsewhere. On database quota or write failure show an actionable warning, retain current in-memory results, and never silently remove screenshots or evict older history. When Runner recovers an old report from its existing server endpoint, persist the recovered screenshots too. The two source report archives remain hidden from runtime routes and menus.

Publish playground payloads through the GenUI server's PUT endpoints and use the returned public URL as an opaque value; do not hardcode storage-provider hosts or object paths in frontend code. Publish a shared conversation with storage type `conversation` and its validated protocol (`a2ui`, `openui`, `mcp-apps`, `lynx-xml`, or `html`) as the storage method; treat a missing protocol as legacy A2UI and reject an unknown protocol before uploading. When importing shared playground conversations, accept same-origin HTTP(S) documents or credential-free cross-origin HTTPS documents, fetch them with credentials omitted, then validate the shared document schema and protocol before calling `importShared`. Treat a missing shared-document protocol as legacy A2UI, and reject unknown or mismatched protocols.

## Component Catalog Architecture

### Shared Page and Protocol Sources

Keep page structure and editor/example selection state in `pages/catalog/ComponentCatalog.tsx`, with its styles co-located in `pages/catalog/ComponentCatalog.css`. Route both protocols through `pages/catalog/ComponentsPage.tsx`, and keep protocol-specific catalog data, validation, and render URL construction in `pages/catalog/a2ui.ts` and `pages/catalog/openui.ts`.

Use `catalog` as the canonical tab id and URL segment for both A2UI and OpenUI component catalogs. Continue parsing legacy `components` URLs as a compatibility alias, but generate all new navigation and component-detail links with `catalog`.

Keep the shared editor, copy feedback, example tabs, and `PreviewViewport` layout in `pages/catalog/ComponentUsagePreview.tsx`.

### Shared Presentation

Keep the A2UI and OpenUI component catalog pages visually identical by rendering both through `ComponentCatalog` and selecting a protocol-specific catalog source. Protocol-specific sources may vary their copy, routes, catalog data, validation, and preview payload construction, but must not duplicate the shared page JSX or add protocol-specific page-shell or component-card styling overrides.

### Catalog Preview Payloads

Use the headless OpenUI component library's real JSON schema for Playground DSL parsing in Catalog, Examples, and Chat. Keep the shared `parseOpenUIScenario` helpers backed by `createOpenUiPromptLibrary`, and always derive editor JSON from the current source rather than a scenario's stored `parsed` snapshot. Do not reintroduce a hand-written schema with empty prop fragments, because it hides type and enum errors that the Lynx renderer reports.

Send editable OpenUI usage DSL through `buildOpenUIRenderUrl` with `instant: true`, and forward the playground theme so the Lynx preview matches the surrounding catalog page.

Component catalog examples are intentionally inline-only. Keep every bundled usage snippet below `OPENUI_INLINE_RENDER_URL_MAX_LENGTH`, reject oversized edits with a visible error, and reserve `rawTextUrl` publishing for larger Examples/Create payloads rather than publishing on each catalog-editor keystroke.

## Example Showcase Architecture

Count tokens from the currently displayed editor view. Switching between Original and Transformed must update the count to that view's exact text, including whitespace, using `o200k_base`.

Keep the shared example-list page structure, preview queue, keyboard interaction, section rendering, and card layout in `pages/demos/DemosList.tsx`. Route A2UI, OpenUI, and MCP Apps through `pages/demos/DemosListPage.tsx`, and keep protocol-specific scenarios, sections, preview URL construction, and queue reset keys in `pages/demos/a2ui.ts`, `pages/demos/openui.ts`, and `pages/demos/mcp-apps.ts`.

Protocol-specific showcase sources may vary their header copy, section links, badges, layout mode, and preview payload construction, but must not duplicate the shared list-page JSX or card interaction logic.

Keep the shared example-detail workspace, editor/preview resizing, playback state machine, progress bridge, scenario sidebar, and mobile tabs in `pages/demos/DemosPage.tsx`, with its styles in `pages/demos/DemosPage.css`. Keep protocol-specific editor configuration, commit validation, playback chunking, payload publishing, and `PreviewPanelSource` construction in the respective `pages/demos/a2ui.ts`, `pages/demos/openui.ts`, and `pages/demos/mcp-apps.ts` source modules.

Keep MCP Apps Examples aligned with the renderer registry in `lynx-src/mcp-apps/App.tsx`. Build their deterministic preview data through each renderer's sibling `api.ts`, validate edited data with the shared host parser plus the renderer-specific result parser, and render list and detail previews through the existing `mcp-apps.web.js` / `mcp-apps.lynx.js` bundles.

### Lynx XML

- Store an XML template example's optional style preset in its scenario metadata and pass it to `compileLynxXmlFragment` both for its initial source and for edited/Transformed previews. Keep the editable template unchanged; list previews must resolve the registered example by `exampleId` so they receive the compiled styles as well.
- Expose Lynx XML Create at its protocol root, Examples at `/examples`, and the shared Bench tab linking to the canonical `#/bench` route; keep Catalog unavailable. Route Create through the shared Chat controller and the dedicated Lynx XML adapter.
- Stream cumulative canonical source into the Create artifact viewer as soon as `<!doctype lynx>` arrives. Do not reload `<lynx-view>` for incomplete source; hand the complete document to the direct Lynx XML preview only after the final stream event.
- Reuse the A2UI Playground Examples `flow` layout, `DemosList`, `ExamplePreviewCard`, and card styles without protocol-specific markup or CSS.
- Keep complete `.lynxml` artifacts in `src/mock/lynx-xml`, import them as raw editor source, copy them to `dist/demos/lynx-xml`, and load them directly in `<lynx-view>`. Mount generated and edited XML through `PreviewViewport`'s direct `LynxXmlView`; use an `application/xml` Blob URL only to satisfy LynxView's public URL input, and never turn XML into A2UI/OpenUI init data, global props, or events. Use the shared `render.html?protocol=lynx-xml&sourceUrl=...` entry for shareable/example Web URLs and keep its XML protocol branch direct instead of invoking a bundled protocol renderer. Do not add per-example compilation or a ReactLynx renderer. Browser-local Blob URLs are not shareable: keep the Web and Native QR cards mounted with an unavailable placeholder instead of encoding the Blob URL or removing the QR pane. Use `@codemirror/lang-html` in the editor and keep Playback disabled.
- Append the business root directly to the Element PAPI `page`; do not style the page or add a generic `app` wrapper. The root owns viewport, background, and layout styles, and must be a vertical scroll view when content may overflow. Because Lynx defaults to Linear layout, every layout container must explicitly use `display: flex` and declare its intended `flex-direction`.

### HTML

- Expose HTML at its Create protocol root and in the shared Bench tab; keep Examples, Catalog, and native preview unavailable.
- Stream cumulative source into the shared artifact viewer as soon as the HTML doctype arrives, but do not execute partial markup or scripts. Deliver only a complete document to the reload-based preview.
- Render HTML through `HtmlView` as iframe `srcDoc` with exactly the script capability required for generated interactions. Keep `allow-same-origin` out of the sandbox so model-authored code cannot read the Playground DOM, cookies, or local storage. Do not send HTML through `render.html`, `<lynx-view>`, init data, global props, native URLs, or Lynx bundles.

## OpenUI Integration

### Lynx Entry Styling

When maintaining the OpenUI Lynx entry under `packages/genui/playground/lynx-src/openui`, import only the host-level style inputs that the entry owns: `@lynx-js/luna-styles/index.css` first, then `@lynx-js/genui/openui/styles/theme.css`. Do not import OpenUI catalog CSS, renderer CSS, `styles/material-icons.css`, `styles/index.css`, or `styles/renderer.css` from the playground entry.

OpenUI catalog styles are bundled by each catalog component's relative CSS import, the renderer style is bundled by `renderer.tsx` importing `./renderer.css`, and Material Icons font CSS is bundled by the Icon component. If the native preview looks unstyled, fix the source-side CSS import in `packages/genui/openui` instead of adding a package-level aggregate stylesheet to the playground entry.

OpenUI playground theming should apply matching classes such as `openui-light luna-light` or `openui-dark luna-dark` on the Lynx root view. Keep theme-specific feedback, loading, and scroll styling in the entry CSS instead of inline styles so Luna variables can control both the shell and renderer content.

Gate host-specific OpenUI visual treatments behind an additional root class in the playground entry CSS instead of changing the shared OpenUI theme tokens. For transparent editorial previews, keep the root, page, and scroll backgrounds transparent; scope Card surface removal and enlarged typography/spacing to that host class so the package defaults and Modal/control boundaries remain intact. Keep the render document's `data-theme` and `color-scheme` synchronized with preview init data so transparent Lynx content inherits the correct neutral light or dark device canvas instead of the iframe's default white background.

### Large Preview Payloads

Keep A2UI Create's live iframe on a stable, empty bootstrap Blob URL for the duration of a generation. Reuse the same bootstrap array reference: the local Blob cache uses object identity, so an inline empty array still changes the URL. Deliver content through the runtime-ready message bridge; published final payload URLs belong to share/native links and must not navigate the live iframe. Start a new generation with an explicit preview revision. Compare streamed and final A2UI surface snapshots before replaying, accounting for temporary Loading nodes and split component batches while preserving data-model differences. Skip redundant final replays for Create and actions, but retain authoritative replay for repaired/different results, JSON-only replies and newly ready frames. Do not infer equivalence from message-array identity or length. Regression tests must cover the actual controller, panel and viewport together, asserting iframe identity and bridge messages through completion and the Generation metric update.

For local A2UI Web previews without `demoId` or `messagesUrl`, serialize the messages into an `application/json` Blob and pass its object URL through `messagesUrl` so local and remote JSON use the same runtime loading path. Reuse that object URL while the messages are unchanged; after replacement, keep it alive until the consuming runtime reports that loading completed, with a bounded cleanup fallback, and revoke all remaining URLs on unmount. Deliver later live deltas through `A2UI_LIVE_MESSAGES`, and replay the current surface only after the Lynx A2UI runtime reports that its message store is ready; the outer render-frame listener alone is not sufficient readiness. Give every `PreviewViewport` render navigation a unique token, require runtime-ready messages to echo it, and bind readiness fallbacks to the loaded URL and window so a delayed signal from an older iframe document cannot unlock the current frame. Blob URLs are local-only: share and native URLs must never expose them, and live share/native URLs require `demoId` or a published HTTP(S) `messagesUrl`. Apply `A2UI_INLINE_RENDER_URL_MAX_LENGTH` to remaining non-live inline A2UI preview URLs so deployed request-line limits cannot produce HTTP 414 responses.

When building OpenUI playground preview links, avoid inlining large OpenUI Lang source in `rawText` query parameters. URL-encoded Chinese or generated DSL can exceed common request-line limits on deployed hosts; publish large source text and pass `rawTextUrl` to `render.html` instead.

## LazyComponent Integration

### Bundle Build

When adding a GenUI playground example that uses a ReactLynx standalone lazy bundle, build that lazy bundle with a separate Rspeedy config using `pluginReactLynx({ experimental_isLazyBundle: true })`.

Keep `output.cleanDistPath: false`, and run the lazy bundle build after the main `rspeedy build` so the main preview bundle does not clean the lazy bundle assets.

Keep both `web` and `lynx` environments enabled when the same lazy demo should run in browser and mobile previews. The lazy bundle output names should stay paired, for example `a2ui-lazy-component.web.bundle` for Lynx for Web and `a2ui-lazy-component.lynx.bundle` for native Lynx.

### URL and Payload Ownership

LazyComponent demo data should contain complete `url` and `webUrl` values before it reaches preview rendering. Build those URLs at data construction time from the runtime playground base URL, with query and hash removed and file paths such as `render.html` collapsed to their containing directory. Keep this resolution in the demo data layer, not in `PreviewPanel`.

Only demos backed by files copied to `dist/demos/*.json` should use `demoId` short links. Runtime-built demos such as `lazy-component` and `mcp-app` should remain known playground scenarios, but because no corresponding `dist/demos/*.json` file exists, their local Web preview should expose the messages through a Blob `messagesUrl` while non-live native QR preview links may continue to carry inline `messages`.

Keep `PreviewPanel` unaware of LazyComponent payload structure. It should select `demoId`, a portable `messagesUrl`, or local `messages/actionMocks`; derive a Blob `messagesUrl` only for the local Web preview, while keeping share and QR/native payloads portable.

For the A2UI `LazyComponent` catalog component, load ReactLynx standalone lazy bundle URLs with `import(url, { with: { type: 'component' } })`. In web rendering, use `webUrl` only when `SystemInfo.platform === 'web'`; if `webUrl` is absent, show the mobile-scan fallback instead of trying to load the native `url` in Lynx for Web.

Keep Bench database migration and persistence in `packages/genui/playground/src/storage/benchRepo.ts`, with schema upgrades in the existing `storage/db.ts`. Keep Bench history types, normalization, React hooks, and Bench-specific tests in `packages/genui/playground/src/pages/bench`. Upgrade the existing database without replacing conversation stores. Import legacy `a2ui-bench-history` localStorage records and the fallback report selection in one transaction; remove the legacy copy only after commit, and do not overwrite existing database IDs. Wait for hydration before enabling Bench mutations, serialize writes against the last successful snapshot, and apply record-level deltas so another tab’s unrelated entries survive. Keep report selection tab-local in sessionStorage, notify detail tabs after committed writes, and open the blank detail tab synchronously before awaiting database writes.

For Lynx XML results transformed by Template or StylePreset, show the exact `done.metadata.modelOutput` as
Original by default and the final Source as Transformed in the
shared artifact viewer. Copy the selected view's text. Do not show a separate
XML Fragment view. Preserve `lynxXmlFragment` and `lynxXmlModelOutput` in local
and shared assistant history, keeping both out of runtime preview sources and
model conversation inputs. Results with no source transformation show only Source;
older converted results without model output must not fabricate a before view.
