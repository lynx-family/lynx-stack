---
applyTo: "packages/genui/server/**"
---

# GenUI Server Architecture

Keep protocol-neutral request infrastructure in `app/common`. Request-size enforcement, JSON parsing, chat and conversation validation, provider override selection, error and usage extraction, CORS, rate limiting, SSE encoding and headers, and stream logging must not live under a protocol route such as `app/a2ui`.

Keep shared agent-service contracts and helpers in `service/common`. `ChatMessage`, `ConversationContext`, generic provider options, provider agent caching, conversation assembly, model-message conversion, Mastra result extraction, and stream adaptation must not be imported from `service/a2ui-agent` by OpenUI or MCP Apps. Extend the generic options inside `service/a2ui-agent` only for A2UI-specific catalog and repair settings.

Keep public provider integrations vendor-neutral. Do not commit deployment-only gateway rewrites, private hostnames, environment-specific authentication conventions, or credentials; inject those only through the deployment environment.

Configure GenUI providers only through `GENUI_MODEL_CONFIG_JSON` as an object keyed by public model name. Give every value its own upstream `model`, credentials, base URL, and optional API style, reasoning effort, and default marker. Keep public responses, including `GET /models` and health endpoints, limited to public model names and readiness metadata; never expose upstream model ids, credentials, base URLs, or API styles. Redact those private configuration values from upstream errors before logging or returning them to clients. Resolve an ordinary client model selection through its configured name before creating the provider.

Publish A2UI and OpenUI preview payloads to Volcengine TOS with the native server-side SDK. Keep TOS AK/SK or temporary STS credentials on the server, grant that identity only `tos:PutObject` for the configured prefixes, and do not set a public object ACL during upload. The bucket policy owns public reads; return an unsigned public bucket URL to preview clients.

Use `app/common/sse.ts` for standard SSE frames and response headers. Pass event IDs or additional headers through its options instead of cloning the SSE framing and header literals in individual functions.

Build `genui-server` as an executable ESM Hono server through `rslib.config.ts`. Each protocol `route.ts` default-exports a Hono sub-application, `src/app.ts` composes the route tree and common HTTP fallbacks, and `src/index.ts` starts `@hono/node-server` and owns graceful process shutdown. Do not export endpoint request functions or add a custom router or Node/FaaS transport adapter. Keep business handlers based on standard Web `Request` and `Response` internally.

Read the server port from `LYNX_USE_PORT`, defaulting to `3000`; do not use `PORT` as a compatibility fallback.

Read the bind address from `LYNX_USE_HOST`, defaulting to the IPv6 unspecified address `::` so Node accepts both IPv6 and IPv4 connections through its dual-stack listener; do not use `HOST` as a compatibility fallback. Format IPv6 addresses with brackets when logging HTTP URLs.

Derive CORS preflight and 405 `Allow` behavior from the composed Hono application's route table after mounting sub-applications. Do not maintain a second hand-written route and method inventory.

Every SSE route that starts model generation must propagate both `Request.signal` aborts and response-stream cancellation to the upstream model call. Guard enqueues and stream closure against reader cancellation, remove abort listeners during cleanup, and cover the disconnect path with a test.

Bound graceful process shutdown so long-lived SSE connections cannot block it indefinitely. Track and destroy remaining connections after the grace period in a way that works for both HTTP/1 and HTTP/2; do not rely only on HTTP/1-specific server methods.

Target the repository-supported Node.js 22 and 24 release lines. Let `@hono/node-server` own HTTP/1 and HTTP/2 request adaptation, including HTTP/2 pseudo-header filtering; do not recreate that transport code locally. Use explicit `.js` specifiers for relative ESM imports and re-exports so TypeScript resolves the source modules while the emitted JavaScript remains valid native Node ESM.
