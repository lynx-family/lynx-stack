# GenUI Server

This package contains the Next.js server for GenUI agent APIs, including
A2UI, OpenUI, Lynx XML, and MCP Apps.

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

The server fails fast at startup (via `instrumentation.ts`) when any of
these are missing in production. In development, a warning is logged
instead so the playground keeps working.

## Security

By default, request bodies submitted to `/a2ui/chat`, `/a2ui/stream`,
`/a2ui/action`, `/openui/stream`, `/lynx-xml/stream`, and `/mcp-apps/stream`
**cannot** override `apiKey` or `baseURL`. This
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

The `/a2ui/chat`, `/a2ui/stream`, `/a2ui/action`, `/openui/stream`,
`/lynx-xml/stream`, and `/mcp-apps/stream` routes share an
in-process fixed-window rate limiter keyed by client IP (`x-forwarded-for`

> `x-real-ip` > `unknown`). When a client exceeds the limit, the
> JSON routes respond with HTTP `429` and the SSE route emits a single
> `event: error` frame; both responses include the standard
> `Retry-After` and `X-RateLimit-*` headers.

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
`/lynx-xml/stream`, and `/mcp-apps/stream` accept an optional `conversation`
request field:

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

## Lynx XML

`/lynx-xml/stream` uses the prompt and validator from
`@lynx-js/genui-lynx-xml`. The Node-only prompt entry directly loads the
installed `@lynx-js/skill-vanilla-lynx` package and adapts it to a
self-contained `<!DOCTYPE lynx>` artifact. Keep the CSS restrictions from
`@byted-lynx/lynx-api-docs` `lynx-vs-web/unsupported-features.md` and
`lynx-vs-web/css-differences.md` explicit in the prompt. Do not add a CSS
support Skill dependency or compatibility query tool, and do not infer CSS
support from browser behavior.
Lynx XML generation is non-streaming: wait for `agent.generate` to return the
complete response, validate it, then return one JSON response. If validation
fails, use bounded full-artifact regeneration with the normalized source,
validation errors, and finish reason; do not append missing tags to potentially
truncated JavaScript. Do not call `agent.stream` or forward model deltas. The
legacy `/lynx-xml/stream` path is retained only for URL compatibility.

`/lynx-xml/payload` validates the artifact again, then stores it as
`application/xml`. `SUPABASE_LYNX_XML_STORAGE_PREFIX` optionally changes the
default `lynx-xml` object prefix.

## Bench Preview and Judge

Bench preview uses Playwright to open the Playground `render.html` runtime.
A2UI runs through its protocol-message bridge. OpenUI and Lynx XML are exposed
to the browser through intercepted, same-origin source requests; Lynx XML
executes directly in web-core without compilation. All protocols use the
captured browser pixels for screenshots and visual judging. Keep the visual
judge protocol-blind: its prompt may include the shared task, scenario, visible
action, and interaction steps, but must not include protocol, model, group, or
implementation metadata.

Set `A2UI_BENCH_PLAYGROUND_BASE_URL` when the default deployed Playground is
not reachable from the server. Local development URLs are accepted only in
development. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`,
`CHROME_EXECUTABLE_PATH`, or `CHROMIUM_EXECUTABLE_PATH` to select a browser
binary; serverless deployments fall back to `@sparticuz/chromium`.

Judge calls use the Bench provider by default. The following variables can
override the visual model independently:

```bash
export A2UI_BENCH_JUDGE_API_KEY="..."
export A2UI_BENCH_JUDGE_BASE_URL="..."
export A2UI_BENCH_JUDGE_MODEL="..."
export A2UI_BENCH_JUDGE_API="chat" # or responses
```

Legacy `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_BASE_URL`, and
`MIDSCENE_MODEL_NAME` are accepted as fallback configuration names only; the
Bench Judge does not depend on Midscene.

## Development

Run the development server from this package:

```bash
pnpm dev
```

The server listens on port `3060` by default.

## Production

Build and start the production server from this package:

```bash
pnpm build
pnpm start
```
