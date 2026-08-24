# GenUI Server

This package contains the Rslib-built Hono server for GenUI agent APIs,
including A2UI, OpenUI, and MCP Apps.

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

## Required Model Configuration

Before starting this server, provide the provider credentials, endpoint, and
model list through one JSON environment variable:

```bash
export GENUI_MODEL_CONFIG_JSON='{
  "GPT-5.4": {
    "model": "gpt-5.4",
    "apiKey": "...",
    "baseURL": "https://api.openai.com/v1",
    "api": "responses",
    "default": true
  }
}'
```

- Each top-level key is the public model name returned to the playground.
- Each value requires `model`, `apiKey`, and `baseURL`, so models may use
  independent upstream ids, credentials, and endpoints.
- `api` is optional and accepts `chat` or `responses`.
- `default: true` is optional. When omitted, the first entry is the default.
- `reasoningEffort` is optional per model.

`GET /models` exposes only the top-level names and default selection. It must
never expose `model`, `apiKey`, or `baseURL` to the playground.

The A2UI agent generates image assets through a server-side Volcengine Ark
tool. The Ark credential, image-generation model name, and base URL are
required:

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

Image generation uses Mastra tool suspension. The agent first streams a
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

To let the A2UI agent retrieve current or externally verifiable public-web
information, configure the optional server-side Doubao Search credential:

```bash
export SEARCH_INFINITY_API_KEY="..."
```

When the key is present, the server conditionally registers a `web_search`
tool. The tool calls the Doubao Search Custom web API, which supports both
subscription-plan and post-paid API keys, with a fixed maximum of five text
results and never returns search images. It may be called at most three times
per HTTP request across the initial generation and all repair attempts.
`SEARCH_INFINITY_REQUEST_TIMEOUT_MS` optionally overrides the 10-second
request timeout and must be an integer from 1 through 60000. Keep the key
server-only and do not include a `Bearer` prefix. Missing configuration leaves
search disabled without affecting the rest of the A2UI server; `GET
/a2ui/health` reports this through `webSearchReady`.

URLs supplied by the user or returned by the current request's search scope
may be used with `openUrl`. The server rejects other model-generated targets,
and the streaming parser keeps components with untrusted links in a loading
state until final validation. Bench runs explicitly disable web search so
their output stays deterministic.

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
`a2ui`, `openui`, and `mcp-apps` prefixes. Preview objects use
`<method>/preview/<uuid>/<file>`; shared conversations use
`<method>/conversation/<uuid>/messages.json`. The server signs writes with
these credentials; the browser reads the resulting public object URL without
credentials. Optional overrides are `TOS_ENDPOINT`, `TOS_STORAGE_PREFIX`,
`TOS_OPENUI_STORAGE_PREFIX`, `TOS_MCP_APPS_STORAGE_PREFIX`, and
`TOS_SECURITY_TOKEN`.

To enable UI Judge scoring for A2UI Bench jobs, run the independent Rust UI
Judge HTTP server and configure its private base URL:

```bash
export UI_JUDGE_SERVER_URL="http://127.0.0.1:8080"
```

The server probes `GET /health` for each Bench job and reports Judge as enabled
only when the sidecar worker is ready. This is a shallow readiness check; model
credentials, the configured bundle, and runtime resources are validated by the
first `/judge` request. Successful A2UI generations are submitted to
`POST /judge`; generated messages are injected through server-owned Lynx
`globalProps` and cannot be supplied or overridden by Bench clients.

Before rendering, the Bench integration replaces `Image`, `LazyComponent`,
`LineChart`, `McpApp`, and `PieChart` definitions with inert loading
placeholders, downgrades Markdown text, and rejects recursive `openUrl`
function calls. Bench prompt catalogs also omit `openUrl` to avoid generating
those calls in the first place. Keep this boundary in place: model output must
not make the server-side headless resource loader fetch arbitrary URLs, read
local files, or execute nested bundles.

By default, Judge renders
`https://lynx-stack.dev/genui/a2ui.lynx.js`. Override that server-owned bundle
URL when running a local or pinned bundle:

```bash
export UI_JUDGE_BUNDLE_URL="http://127.0.0.1:3000/a2ui.lynx.js"
```

## Security

By default, request bodies submitted to `/a2ui/chat`, `/a2ui/stream`,
`/a2ui/action`, and `/mcp-apps/stream` **cannot** override `apiKey` or
`baseURL`. This
prevents an unauthenticated client from turning the server into an open
proxy that uses arbitrary keys against arbitrary OpenAI-compatible
endpoints.

For trusted local development workflows where overriding is desirable
(e.g. the playground swapping providers), opt in explicitly:

```bash
export A2UI_ALLOW_CLIENT_OVERRIDE="1"
```

Do **not** enable this flag on a publicly reachable deployment unless
authentication and an allow-list are added in front of the server.

## Rate Limiting

The routes at `/a2ui/chat`, `/a2ui/stream`, `/a2ui/action`, and
`/mcp-apps/stream` share an in-process fixed-window rate limiter keyed by
client IP (`x-forwarded-for` > `x-real-ip` > `unknown`). When a client exceeds
the limit, the JSON routes respond with HTTP `429` and the SSE route emits a
single `event: error` frame; both responses include the standard `Retry-After`
and `X-RateLimit-*` headers.

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
`/a2ui/stream`, `/a2ui/action`, `/a2ui/action/stream`, and
`/mcp-apps/stream` accept an optional `conversation` request field:

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
