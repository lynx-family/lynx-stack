# GenUI Server

This package contains the Rslib-built Node.js server for GenUI agent APIs,
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

The hosting runtime must provide these variables before invoking the handler.

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

The `/a2ui/chat`, `/a2ui/stream`, `/a2ui/action`, and `/mcp-apps/stream`
routes share an
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

Watch and rebuild the handler bundle from this package:

```bash
pnpm dev
```

## Production

Build the production handler from this package:

```bash
pnpm build
```

Rslib emits a standard Node HTTP handler at `dist/index.js`:

```ts
export async function handler(request, response) {
  // Handle one IncomingMessage and write one ServerResponse.
}
```

The package does not create a listening server or own a process lifecycle.
Platforms should invoke this handler directly. Runtime packages are bundled
except for `@mastra/core`, which remains external and must be present in the
production install together with its transitive dependencies.
