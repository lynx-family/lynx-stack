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

## Required Environment Variables

Before starting this server, explicitly provide these three environment
variables:

```bash
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="..."
export OPENAI_MODEL="..."
```

- `OPENAI_API_KEY` is required by the OpenAI provider.
- `OPENAI_BASE_URL` selects the OpenAI-compatible API endpoint.
- `OPENAI_MODEL` selects the model used by the A2UI agent.

Image components are resolved after A2UI validation. To enable query-matched
stock images, provide a Pexels API key:

```bash
export PEXELS_API_KEY="..."
```

When `PEXELS_API_KEY` is absent or Pexels returns no result, the server falls
back to a deterministic Picsum URL.

The hosting runtime must provide these variables before starting the server.

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

The server listens on `0.0.0.0:3000` by default. Override the bind address and
port with `HOST` and `PORT`.

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

From the repository root, `./start.sh` provides the production entry point. It
checks for a supported Node.js 22 or 24 runtime and the built server artifact
before launching the same `dist/index.js`.

When `REQUIRE_HTTP_MESH=True`, `start.sh` requires `MESH_INGRESS_PORT`, binds
the server to `127.0.0.1`, and publishes `MESH_INGRESS_PORT` through `PORT`.
The server directly consumes `HOST` and `PORT`. Outside the mesh, the launcher
preserves direct overrides and the `0.0.0.0:3000` default.

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
