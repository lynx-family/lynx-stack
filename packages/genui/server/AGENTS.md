# GenUI Server

This package contains the Rslib-built Hono server for GenUI agent APIs,
including A2UI, OpenUI, MCP Apps, streamed Lynx XML, and standalone HTML
generation.

## Source Layout

Both `agent` and `service` are organized into `common`, `a2ui`, `openui`,
`html`, `lynx-xml`, and `mcp-apps` directories. Keep protocol factories,
prompts, catalogs, parsers, validators, and custom tools in the corresponding
`agent/<protocol>` directory; keep protocol services and Bench adapters in
`service/<protocol>`.

`agent/common` owns provider/security helpers, search and image-generation
tools, the Mastra runtime, and screenshot evaluation. `service/common` owns
shared service contracts and infrastructure. `service/common/bench` contains
cross-protocol scheduling, request normalization, storage, report types,
redaction, screenshot conversion, and Judge orchestration. Bench orchestration
may wire protocol implementations; ordinary common helpers must not depend on
protocol services.

When moving sources, update route imports, test mocks, documentation, and the
`a2ui-prompt` package's re-exports, TypeScript includes, and Turbo inputs
together. Do not leave forwarding modules at obsolete paths.

## Deployment Model

This server is safe to run on serverless and multi-replica deployments for
A2UI conversation state because the client sends the current conversation
context with each request.

- The agent cache (`agentCache`) lives in process memory and may be rebuilt
  per instance.
- The rate limiter is process-local.
- The OpenAI agent service is a `globalThis` singleton.

For multi-instance deployments, place a shared rate limiter (e.g. an API
gateway or Redis-backed limiter) in front of this server when global rate
limits are required.

## Model Configuration

### Jev component composition in A2UI Create

Add a server-owned TypeSafe entry to `GENUI_MODEL_CONFIG_JSON`:

```json
{
  "Jev": {
    "provider": "typesafe",
    "model": "jev-latest",
    "apiKey": "YOUR_TYPESAFE_API_KEY",
    "baseURL": "https://api.typesafe.ai/v1"
  }
}
```

Merge this entry with existing models rather than replacing their configuration.
After restarting the server, select Jev in A2UI Create. `/models?protocol=a2ui`
includes composition models; ordinary `/models` omits them for the other Create
protocols and Bench. The public `composition: true` flag describes capability;
credentials and upstream identifiers remain private. Jev is not a chat model,
so do not configure `api`, `reasoningEffort`, or `maxOutputTokens` for it.
Create keeps the same demo prompts and settings for every model to support
comparison, including the shared Design Guidance switch.

Alternatively, in A2UI Create choose **Custom API key**, select the **TypeSafe
Jev** endpoint, and enter a TypeSafe key. The default model is `jev-latest` and
may be changed to another TypeSafe evaluation model. This works without
`GENUI_MODEL_CONFIG_JSON`. Generation and action requests supply the complete
`model`, `apiKey`, and `baseURL` tuple; the exact `https://api.typesafe.ai/v1`
endpoint (with an optional trailing slash) selects Jev composition. Custom
fetches reject redirects and never inherit server credentials or enter the
language-model agent cache. The key, endpoint and model remain in page memory
only. Other Create protocols and Bench do not offer this endpoint.

Jev generation uses only the selected TypeSafe evaluation model. Do not require
or invoke a second text model for content preparation or fallback. Build finite
component and property choices from the active Catalog, user-supplied text/JSON,
existing components and state bindings. No business-domain recipes, fixed sample
datasets or quoted-heading requirement belong in this path. Jev selects among
these values; it cannot invent arbitrary prose or data absent from the choices.

Rank current explicit values, matching JSON fields and complete phrases ahead of
derived word fragments. Start with 32 choices per property and expand up to 96
for supplied content, bindings and Catalog alternatives, retaining a fragment
reserve for unquoted multilingual copy. Empty Catalog placeholders are distinct
from explicit empty input and enum/const choices. Skip absent optional properties
with only placeholders; deduplicate equivalent retained/candidate values.
Do not offer synthetic empty placeholders for required display properties;
without supplied content, omit the corresponding new component. Keep explicit
empty values, enums/consts, bindings and initial bound input values available.
RadioGroup choices use `items`, not component child references.
The component-retention decision can select `preserve` to reuse optional values
and omissions on a node and its fixed children, while movable descendants decide
independently. Required content and current host-resource authorization still run.
Keep optional styles configurable when not explicitly preserved by that decision;
do not guess user intent using a fixed language or business vocabulary.

Composition selects component counts and retained subtrees, then properties,
then layout. Counts exclude automatically created compound labels and slots.
Batch new Text copy and independent properties with each text's owner, role,
ordinal and the full copy-target plan. After final layout, only duplicate new
literal Text siblings receive one further allocation from unused candidates or
explicit omission. Resolve those conflicts sequentially before the final snapshot;
preserve existing content, bindings, fixed labels and distinct styles/scopes.
Remove new empty container subtrees after layout.
Resolve single-option questions locally. Batch at most 32 remaining questions per
evaluation with at most two concurrent batches within the same independent phase,
using the same Jev connection throughout. On failure, cancel sibling calls, stop
queued batches and drain in-flight requests before reporting their completed usage.
Plan structural parent edges in one question set, excluding each moving unit's
own descendants. Install valid edges locally in dependency order; ask Jev to
resolve only cycles and depth conflicts using replacement edges to placed
containers. Keep compound slots, templates and retained descendants together.
The existing retention question can choose `keep_layout`/`preserve_layout` to
keep parent and relative sibling order, or `reorder`/`reorder_preserve` to keep
the parent alone. The preserve variants also retain optional properties; `keep`
and `preserve` permit reparenting. Movable descendants decide independently.
Only ids from the previous snapshot have existing parent/position metadata;
new nodes' temporary root placement is not an existing layout to preserve.
Expose fixed-child ownership, planned edges and actual sibling groups to layout batches.
Include fixed children, compound slots, template scopes and parent-preserved
descendants in each moving unit's depth budget. Only ask position questions for
nodes allowed to change order, using final sibling counts rather than the
whole page. Resolve singleton positions locally and merge changed positions into
the retained children-array order. Order only after leaf parents are resolved;
resolve tied positions explicitly instead of using component enumeration order.
Publish the completed layout, never the temporary staged tree.
Never reuse a removed id for new content in the same edit. Validate each
published snapshot against the Catalog and
check the combined tree (64 components, eight levels). The whole request has a
60-second deadline and no automatic retries. Aggregate usage from all completed
Jev evaluations, including failures, using the selected model's prices.

Create and action streams emit `model` events for actual Jev provider calls.
Each call has an invocation-local index, composition phase, request counts and
sizes, duration, status and normalized response usage. Agent interaction shows
the total number of requests and retains it when older timeline events are
omitted. Locally resolved questions are not requests. These events contain no
raw prompts, choices, provider connection details or error bodies, and do not
replace aggregate token usage or enter persisted conversation history.

Preserve existing input bindings and data on follow-up edits, including compound
children, named slots and repeating template scopes. New inputs use local data
bindings. Send only topology, display copy and binding paths/types to Jev, never
entered input values or action context. Generic server-dispatched events may
change UI composition; they do not save records or invoke external services.
User/host-provided images and links use the shared source policies; this path
does not invoke search, image generation or another model.
Offer new Image components only when a supplied literal or binding resolves to
a loadable, allowed image source. Otherwise omit images and compose the rest of
the request; never offer image descriptions or empty strings as Image.url.

McpApp candidates require `A2UIChatOptions.hostedMcpApps`, supplied by the host
through the server service API after registry/resource resolution and result
validation. Each entry has a `ui://` URI, title, native bundle `url`, optional
`webUrl`, and `mcpAppData` containing `renderer` and `input`. Bundle URLs must be
HTTP(S). The public A2UI HTTP handlers do not accept this capability from request
bodies; ordinary Create therefore does not offer McpApp. Jev selects complete
resource tuples and never constructs URLs or render data. The host must supply
resources on each edit; prior model output is not resource authorization.
Native-only resources may intentionally omit `webUrl` and retain the existing
mobile-preview fallback. When no host resources are available, prior McpApp
nodes and invalidated fixed-slot owners are removed before composition.

`agent/a2ui/jev-candidates.ts` builds Catalog/value choices and validates trees;
`agent/a2ui/jev-composer.ts` applies decisions; `agent/common/jev-evaluator.ts`
owns the TypeSafe provider call. Keep credentials server-side. Reference:
[json-render's Jev composition](https://json-render.dev/docs/jev) and
[TypeSafe AI SDK provider](https://ai-sdk.dev/providers/ai-sdk-providers/typesafe-ai).

### Text generation models

To provide server-owned model choices, configure the provider credentials,
endpoint, and model list through one JSON environment variable:

```bash
export GENUI_MODEL_CONFIG_JSON='{
  "GPT-5.4": {
    "model": "gpt-5.4",
    "apiKey": "...",
    "baseURL": "https://api.openai.com/v1",
    "api": "responses",
    "default": true,
    "maxOutputTokens": 32768,
    "input_price": 2,
    "cached_price": 0.5,
    "output_price": 8
  }
}'
```

- Each top-level key is the public model name returned to the playground.
- Each value requires `model`, `apiKey`, and `baseURL`, so models may use
  independent upstream ids, credentials, and endpoints.
- `api` is optional and accepts `chat` or `responses`.
- `default: true` is optional. When omitted, the first entry is the default.
- `maxOutputTokens` is an optional positive integer describing the provider's
  supported output ceiling. All generation agents share a 32768-token per-call
  target through `buildOpenAIRunOptions`, clamped to the effective model ceiling.
  A configured ceiling below 32768 still lowers the request budget; a larger
  ceiling does not raise the default target. This includes raw generation,
  streaming, continuations, and repairs. Judge
  requests score all five dimensions together using the same resolver with a
  4096-token target. Reasoning-only
  recovery may increase the requested budget, within that same ceiling.
- `reasoningEffort` is optional per model.
- `input_price`, `cached_price`, and `output_price` optionally set prices per
  **one thousand tokens**, in CNY (yuan).
  These example prices are illustrative. Each price must be a finite,
  non-negative number and defaults to `0` when omitted. `input_price` applies
  to input tokens that did not hit the cache; `cached_price` applies to cache
  hits; `output_price` includes reasoning tokens.

For generation latency, keep static instructions/catalogs ahead of conversation
history and the latest request. Prompt Cache behavior follows the upstream
provider's defaults. GenUI reports returned cache usage without adding routing
keys, cache options, or explicit breakpoints to model requests. Provider caching
is independent of the process-local Agent instance cache.

Compare cold and warm requests with the same model, catalog, tool availability,
and reasoning settings. The stream logs report `upstream.first_chunk`,
`protocol.first_messages`, cumulative `parseTotalMs`, and final cached-token
counts/ratios. Measure the preview's paint separately: cache-hit counts and
parser microbenchmarks alone do not establish end-to-end latency improvements.

`GENUI_MODEL_CONFIG_JSON` is optional when the request supplies a complete
custom provider with `model`, `apiKey`, and `baseURL`. Partial custom provider
values are ignored rather than inheriting a server-owned credential. An
OpenAI-compatible request-scoped custom `baseURL` must exactly match one of the public
OpenAI-compatible provider URLs in `ALLOWED_CUSTOM_PROVIDER_BASE_URLS` (an
optional trailing slash is normalized). Server-owned model configuration
remains the trusted path for private, HTTP, or deployment-specific endpoints.

`GET /models` returns `defaultModel` and `models: [{ id, label, input_price, cached_price, output_price }]`.
Every entry includes all three prices, including zeros when unconfigured. It
must never expose `model`, `apiKey`, or `baseURL` to the playground.

Generation JSON responses and SSE `done` events include `tokenUsage` alongside
the existing `usage` field. This applies to A2UI chat and actions, OpenUI,
Lynx XML, HTML, and both MCP Apps message and tool-selection responses:

```json
{
  "tokenUsage": {
    "inputTokens": 100,
    "cachedTokens": 60,
    "outputTokens": 20,
    "totalTokens": 120
  }
}
```

`inputTokens` includes `cachedTokens`. The client computes the amount using:

```text
((inputTokens - cachedTokens) * input_price
 + cachedTokens * cached_price
 + outputTokens * output_price) / 1_000
```

The server does not calculate or return a monetary total. A custom provider
has no server-configured prices.

Bench run results include a `modelPrices` snapshot containing only the three
public price fields, captured before generation. Playground displays estimated
amounts in CNY; configure its deployment's rates in CNY per thousand tokens.
Create stores the selected model's prices and usage with each assistant turn.
Historical views use saved rates rather than the current model configuration.

The three price dimensions are always present in `tokenUsage`; `null` means
that the provider did not report a usable count. Keep unknown usage distinct
from an explicit zero, and do not present a complete price when a required
count is unknown. `totalTokens`, `cacheWriteTokens`, and `reasoningTokens` are
also returned when available. Cache-write tokens use the ordinary input price;
reasoning tokens are already included in output and must not be billed twice.
When repairs make additional model calls, return their accumulated usage,
including failed validation attempts. A dimension missing from any attempt
remains unknown in the aggregate.

All five generation agents optionally generate image assets through a shared
server-side Volcengine Ark tool. To enable it, configure all three values:

```bash
export IMG_GEN_ARK_API_KEY="..."
export IMG_GEN_ARK_IMAGE_MODEL="doubao-seedream-..."
export IMG_GEN_ARK_IMAGE_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
```

`IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS` optionally overrides the 120-second
request timeout and must be an integer from 1 through 600000. The agent may
make at most four image-generation calls across the initial response and all
repair attempts for one request. Keep the credential, model name, and endpoint
server-only. The text model configured through `GENUI_MODEL_CONFIG_JSON` must
support tool/function calling. Only user/host-provided image sources and URLs
returned by the request's tool scope may reach the renderer. There is no
stock-image or placeholder-image fallback when generation fails.

A2UI image generation uses Mastra tool suspension. The agent first streams a
complete surface with its theme, body, and a stable-id `Loading` placeholder.
`generate_image` starts Ark generation and suspends the run; the service waits
without closing the SSE response and resumes the same agent run with the image
result. The resumed agent owns the final `updateComponents` or
`updateDataModel` patch. The tool itself never constructs protocol messages.
The JSON endpoints use the same continuation internally but return only after
the resumed agent has completed. Suspended workflow snapshots and pending image
jobs are held in process memory, so an in-flight continuation must remain in
the same live server process. Process restarts and cross-replica continuation
are not supported by this minimum storage configuration.

The hosting runtime must provide these variables before starting the server.

A2UI, OpenUI, Lynx XML, HTML, and MCP Apps generation agents share the same
optional web-search and image-search capability. Configure the server-side
Doubao Search credential:

```bash
export SEARCH_INFINITY_API_KEY="..."
```

When the key is present, each generation agent registers `web_search` and
`image_search` through `agent/common/search-capability.ts`. The internal
`enableWebSearch` option controls both tools and defaults to enabled; missing
or invalid credentials leave both tools unregistered. UI Judge evaluation
agents remain tool-free. Both search tools call the Doubao Search Custom API,
which supports
subscription-plan and post-paid API keys. Web search returns at most five
normalized text results. Image search returns at most five image URLs with
source and quality metadata. The agent should prefer image search whenever a
UI needs an existing image. All five generation agents also provide optional `generate_image`, used
when search fails, has no suitable result, or the user explicitly asks for
original generated artwork. If neither image tool is available or succeeds,
use a non-image presentation. The two search tools may make at most three
calls combined
per HTTP request across the initial generation and all repair attempts.
`SEARCH_INFINITY_REQUEST_TIMEOUT_MS` optionally overrides the 10-second
request timeout and must be an integer from 1 through 60000. Keep the key
server-only and do not include a `Bearer` prefix. Missing configuration leaves
search disabled without affecting the rest of the GenUI server; `GET
/a2ui/health` reports this through `webSearchReady` and `imageSearchReady`.

Each generation request owns its search budget and returned URL registry,
independent of the cached Agent instance. A2UI reuses its image-generation
RequestContext across continuations and validation repairs; Lynx XML shares
its fragment-conversion RequestContext with search. Other generation services
create a shared tool RequestContext through `service/common/agent-capabilities.ts`.
Agent cache keys include both capability settings.

In A2UI, image URLs returned by the current request's image-search scope may
reach the renderer. Source-page URLs returned by either search tool may be
used with
`openUrl`, as may URLs supplied by the user. The server rejects other
model-generated targets, and the streaming parser keeps components with
untrusted sources in a loading state until final validation. A2UI and OpenUI
Bench runs
explicitly disable search and image generation so their output stays deterministic.
Search guidance preserves each protocol's output contract: searches run inside
the server agent, never as OpenUI Query/Mutation calls or MCP Apps routing
targets. HTML keeps scripts and styles inline while allowing image URLs from
the user/host, image search, or image generation, and source links from the user or search.

The internal `enableImageGeneration` option mirrors `enableWebSearch`: it
is enabled by default, `false` omits the tool, and missing or invalid Ark
configuration leaves it unregistered without making health checks fail.
`GET /a2ui/health` reports availability through `imageGenerationReady`.
`agent/common/agent-capabilities.ts` composes both capabilities, and search
instructions suggest generation only when `generate_image` is registered.
OpenUI, Lynx XML, HTML, and MCP Apps await the image tool before emitting their
complete protocol output; only A2UI uses the continuation described above.
All requests receive an independent four-call image budget, sharing their
existing RequestContext with search and protocol-specific tools. UI Judge
scoring agents remain tool-free. Neither capability accepts client credentials.

To publish short, shareable A2UI and OpenUI preview URLs, configure the
public-read Volcengine TOS bucket and server-only write credentials. All four
variables are required; do not add fallback bucket or region values:

```bash
export TOS_ACCESS_KEY="..."
export TOS_SECRET_KEY="..."
export TOS_BUCKET="genui"
export TOS_REGION="cn-beijing"
```

Use a dedicated IAM identity with `tos:PutObject` access only to the configured
`a2ui`, `openui`, `mcp-apps`, `lynx-xml`, and `html` prefixes. Preview objects use
`<method>/preview/<uuid>/<file>`; shared conversations use
`<method>/conversation/<uuid>/messages.json`. The server signs writes with
these credentials; the browser reads the resulting public object URL without
credentials. Optional overrides are `TOS_ENDPOINT`, `TOS_STORAGE_PREFIX`,
`TOS_OPENUI_STORAGE_PREFIX`, `TOS_MCP_APPS_STORAGE_PREFIX`,
`TOS_LYNX_XML_STORAGE_PREFIX`, `TOS_HTML_STORAGE_PREFIX`, and
`TOS_SECURITY_TOKEN`.

## Lynx XML Generation

`POST /lynx-xml/stream` uses a dedicated Vanilla Lynx agent and the shared text
SSE route infrastructure. Stream raw model deltas so the Playground can show
source growth, but normalize and validate the final document envelope before
sending `done`. Preserve usage and finish-reason metadata when validation
fails, and report `length` as an exhausted model output budget rather than only
as a missing XML tag. The final artifact must start with lowercase
`<!doctype lynx>`, use `<lynx engine-version="4.2">`, include exactly one main
thread script, and end with `</lynx>`. Keep generated UI on Element PAPI; do
not route it through ReactLynx, JSX, OpenUI, or A2UI.

Create performs one generation attempt. SDK `maxRetries` defaults to zero
(additional retries), A2UI `maxRepairAttempts` defaults to zero, and Lynx XML
streaming does not continue or regenerate after truncation or reasoning-only
exhaustion. Preserve the original sanitized failure, usage, and finish reason;
the Playground asks the user before starting another request. Do not add a
separate retry switch to Create requests. Raw generation remains single-call,
so Bench retains its configured repair budget. The shared recovery helper is
still bounded by its caller's explicit attempt budget.

`enableHtmlFragment` defaults to false. When enabled, the model outputs one
intermediate document with one root-child `<template>` plus styles and scripts in any order;
the service compiles the template and injects an id-based `createFragment`
helper before final validation. Conversion is deterministic postprocessing,
not a Mastra tool. Keep shared search/image capability scopes independent of it.

Return the exact assembled model text in `metadata.modelOutput` and the successful
original fragment in `metadata.xmlFragment`; omit fragment metadata when off.
Stream model text for source inspection, but deliver only the compiled document
to preview and Judge. Preserve usage and finish reason on compilation failure
so configured Bench repairs count the failed generation.

## HTML Generation

`POST /html/stream` uses a dedicated HTML agent and the shared text SSE route
infrastructure. Stream raw model deltas so the Playground can display source
growth, then extract and validate one complete HTML5 document before sending
`done`. Generated documents must be self-contained and begin with
`<!doctype html>`, contain `<html>`, `<head>`, and `<body>`, and end with
`</html>`. The Playground executes inline scripts in an isolated iframe
without same-origin access; do not add a server-side browser runtime or route
HTML through Lynx.

For Lynx-protocol UI Judge scoring, configure `UI_JUDGE_SERVER_URL` in the Playground's
Bench run settings. The address stays in browser local storage; GenUI Server
must never read it or access the screenshot service. The browser checks
`GET /health` before creating a job with `playground.browserScreenshots: true`.
For each `screenshot-requested` SSE task, it fetches the pending task's capture
fields from `/a2ui/bench/jobs/:jobId/screenshots/:captureId`, requests multipart
`/screenshot/template` or `/screenshot/lynxml` directly from the configured service,
and posts raw BMP or a JSON capture error to the task endpoint. Bound uploads,
timeouts, replay, and cancellation. The deployment must allow browser CORS.
GenUI Server validates the uploaded BMP, converts
the capture to PNG and runs visual-correctness and four GEQI evaluations with
the Bench group's selected model, or the GenUI default. Reuse
`createLLMProvider`, `GENUI_MODEL_CONFIG_JSON`, reasoning settings, token limits,
and cancellation. The screenshot service receives no task, model, or credentials.
Nonempty `judgeSteps` remain unsupported and are rejected before capture.

HTML Bench uses `native` with no catalog and reuses the HTML generation service,
with search and image generation disabled. Its `browser/html` screenshot tasks
carry the complete HTML source and viewport dimensions to the Playground.
The browser uses Element Capture on the sandboxed iframe and uploads the same
top-down 32-bit BMP format. No server browser, Lynx bundle, or screenshot
service URL is involved for HTML-only jobs. Keep shared scoring, cancellation,
usage accounting, and report storage unchanged.

PNG conversion preserves RGBA pixels and happens before model evaluation. Model
inputs retain the full capture; Bench report storage separately applies its
2 MiB per-image and 8 MiB per-job limits. A scoring failure makes the whole Judge
result unavailable, while a report storage limit only omits the screenshot.

Before rendering, the Bench integration replaces `Image`, `LazyComponent`,
`LineChart`, `McpApp`, and `PieChart` definitions with inert loading
placeholders, downgrades Markdown text, and rejects recursive `openUrl`
function calls. Bench prompt catalogs also omit `openUrl` to avoid generating
those calls in the first place. Keep this boundary in place: model output must
not make the server-side headless resource loader fetch arbitrary URLs, read
local files, or execute nested bundles.

By default, Judge securely fetches and renders
`https://lynx-stack.dev/genui/a2ui.lynx.js`. Override that server-owned bundle
URL with another publicly resolvable HTTP(S) asset when pinning a bundle:

```bash
export UI_JUDGE_BUNDLE_URL="https://cdn.example.com/a2ui.lynx.js"
```

The sidecar applies the screenshot endpoint's SSRF policy to this URL, so
localhost, private-network targets, redirects, and URL credentials are
rejected. Use the Rust library API for trusted local bundle capture.

## Security

Request bodies submitted to `/a2ui/chat`, `/a2ui/stream`, `/a2ui/action`,
`/openui/stream`, `/mcp-apps/stream`, `/lynx-xml/stream`, and `/html/stream`
may provide a complete custom `model`, `apiKey`, and `baseURL`. Incomplete
overrides are ignored and ordinary model names resolve only through
`GENUI_MODEL_CONFIG_JSON`.

OpenAI-compatible custom providers accept only the exact HTTPS base URLs in
`ALLOWED_CUSTOM_PROVIDER_BASE_URLS`. A2UI also accepts the exact TypeSafe Jev
endpoint described above, through its evaluation adapter. Reject alternate origins, ports, paths,
credentials, query strings, and fragments. Add a provider only when its
official OpenAI-compatible endpoint is documented and covered by tests. Do not
expose these routes publicly without authentication.

## Rate Limiting

Screenshot model scoring has a separate process-local outbound queue, shared
by resolved upstream base URL and model across Bench jobs. It allows two active
model calls and starts at most one per second. One request contains the screenshot
once and returns visual correctness plus all four GEQI dimension scores, each
with its own criteria and evidence. Keep weights and aggregate calculation
server-owned. Scoring uses prompt-injected JSON instructions with
strict local schema validation, so the selected model need not support native
`json_schema` response formats. Require all five fixed dimension keys and reject
missing or invalid scores. A transient failure retries the complete scoring
request, for at most three attempts with SDK retries disabled. `Retry-After` takes precedence; without it,
HTTP 429 pauses the shared queue for 60 seconds, while other transient errors
use bounded exponential backoff. Waits honor the Judge abort/deadline signal.
Retries reuse the captured screenshot. A final scoring failure does not restart
capture. This queue
does not govern generation calls or other server replicas using the same
upstream quota.

The routes at `/a2ui/chat`, `/a2ui/stream`, `/a2ui/action`,
`/openui/stream`, `/mcp-apps/stream`, `/lynx-xml/stream`, and `/html/stream`
share an in-process fixed-window rate limiter keyed by client IP
(`x-forwarded-for` > `x-real-ip`

> `unknown`). When a client exceeds the limit, the JSON routes respond with
> HTTP `429` and the SSE route emits a single `event: error` frame; both responses
> include the standard `Retry-After` and `X-RateLimit-*` headers.

Tune the limiter with the following optional environment variables:

```bash
# Maximum number of requests allowed per window per client (default: 20).
export A2UI_RATE_LIMIT_PER_MIN="20"

# Window size in milliseconds (default: 60000).
export A2UI_RATE_LIMIT_WINDOW_MS="60000"
```

Because the counter is in-process, it resets on every server restart and
is not shared across replicas. For multi-instance deployments, place a
shared rate limiter (e.g. an API gateway or Redis-backed limiter) in
front of this server.

## Conversation Context

The server does not keep per-thread conversation memory. `/a2ui/chat`,
`/a2ui/stream`, `/a2ui/action`, `/a2ui/action/stream`, `/openui/stream`,
`/mcp-apps/stream`, `/lynx-xml/stream`, and `/html/stream` accept an optional
`conversation` request field:

```json
{
  "conversation": {
    "history": [{ "role": "user", "content": "..." }],
    "dataModel": {}
  }
}
```

The client owns truncation and lifetime. The playground keeps this context in
memory only, so refreshing the page starts a fresh conversation.

## Development

Build, run, and restart the Hono server as sources change:

```bash
pnpm dev
```

The server listens on `[::]:3000` by default. Node uses this IPv6 unspecified
address as a dual-stack listener, accepting both IPv6 and IPv4 connections.
Override the bind address and port with `LYNX_USE_HOST` and `LYNX_USE_PORT`.

Set `GENUI_HTTP2=1` to start a cleartext HTTP/2 (h2c) server instead of the
default HTTP/1 server. HTTP transport adaptation, including HTTP/2
pseudo-header filtering, is owned by `@hono/node-server`.

## Production

Before relying on production artifacts, build the full repository from the
repository root:

```bash
pnpm turbo build
```

Use Turbo filters only for narrower diagnosis. Do not use a package-local
`pnpm build` or a filtered build as a substitute for the repository-root build.

Rslib emits the executable Hono server at `dist/index.js`. Start it with:

```bash
pnpm --filter a2ui-server start
```

At the package root, `./start.sh` provides the production entry point. It
checks for a supported Node.js 22 or 24 runtime and the built server artifact
before launching the same `dist/index.js`. The launcher and server directly
consume `LYNX_USE_HOST` and `LYNX_USE_PORT`, preserving direct overrides and
the dual-stack `[::]:3000` default.

Each protocol module default-exports a Hono sub-application. `src/app.ts`
assembles them, owns path and method matching, and supplies shared 404, 405,
CORS preflight, and error responses. `src/index.ts` starts the Node server and
owns SIGINT/SIGTERM shutdown. The package does not export endpoint request
functions or contain a custom Node/FaaS transport adapter.

Runtime packages are bundled except for `@mastra/core`, which remains external
and must be present in the production install together with its transitive
dependencies.

The supported runtimes are the repository-level Node.js 22 and 24 release
lines. Use explicit `.js` specifiers for relative ESM imports and exports;
TypeScript resolves them to the corresponding source files while the emitted
module remains directly loadable by Node.js.
