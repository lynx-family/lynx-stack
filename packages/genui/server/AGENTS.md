# A2UI Server

This package contains the Next.js server for A2UI agent APIs.

## Deployment Model

This server is designed for a **long-lived, single Node.js process**
(VM, container, or persistent host). It is **not suitable for serverless
or multi-replica deployments** without an external session store, because:

- Conversation memory (`conversations`) and the agent cache
  (`agentCache`) live in process memory.
- The rate limiter is process-local.
- The OpenAI agent service is a `globalThis` singleton.

If you must run behind serverless (e.g. Vercel Functions) or with
horizontal scale, plan to externalize state (Redis, Postgres) and front
the deployment with a shared rate limiter (e.g. an API gateway).

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

The server fails fast at startup (via `instrumentation.ts`) when any of
these are missing in production. In development, a warning is logged
instead so the playground keeps working.

## Security

By default, request bodies submitted to `/a2ui/chat`, `/a2ui/stream`,
and `/a2ui/action` **cannot** override `apiKey` or `baseURL`. This
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

The `/a2ui/chat`, `/a2ui/stream`, and `/a2ui/action` routes share an
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

## Conversation Memory

Per-thread conversation history is held in memory and pruned with two
mechanisms:

- **TTL eviction**: threads idle longer than `A2UI_THREAD_TTL_MS`
  (default `1800000`, i.e. 30 minutes) are dropped on the next sweep.
- **LRU cap**: at most `A2UI_MAX_THREADS` (default `500`) threads are
  retained; the oldest are evicted when the cap is exceeded.

Sweeps are amortized: each call into `getConversation` triggers a sweep
at most once per minute, so the steady-state cost stays close to O(1).
Restarting the server clears all conversation memory.

```bash
export A2UI_THREAD_TTL_MS="1800000"
export A2UI_MAX_THREADS="500"
```

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
