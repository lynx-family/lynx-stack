---
applyTo: "packages/genui/server/**"
---

# GenUI Server Architecture

Keep protocol-neutral request infrastructure in `app/common`. Request-size enforcement, JSON parsing, chat and conversation validation, provider override selection, error and usage extraction, CORS, rate limiting, SSE encoding and headers, and stream logging must not live under a protocol route such as `app/a2ui`.

Keep shared agent-service contracts and helpers in `service/common`. `ChatMessage`, `ConversationContext`, generic provider options, provider agent caching, conversation assembly, model-message conversion, Mastra result extraction, and stream adaptation must not be imported from `service/a2ui-agent` by OpenUI or MCP Apps. Extend the generic options inside `service/a2ui-agent` only for A2UI-specific catalog and repair settings.

Use `app/common/sse.ts` for standard SSE frames and response headers. Pass event IDs or additional headers through its options instead of cloning the SSE framing and header literals in individual functions.

Build `genui-server` as an executable ESM Hono server through `rslib.config.ts`. Each protocol `route.ts` default-exports a Hono sub-application, `src/app.ts` composes the route tree and common HTTP fallbacks, and `src/index.ts` starts `@hono/node-server` and owns graceful process shutdown. Do not export endpoint request functions or add a custom router or Node/FaaS transport adapter. Keep business handlers based on standard Web `Request` and `Response` internally.

Target the repository-supported Node.js 22 and 24 release lines. Let `@hono/node-server` own HTTP/1 and HTTP/2 request adaptation, including HTTP/2 pseudo-header filtering; do not recreate that transport code locally. Use explicit `.js` specifiers for relative ESM imports and re-exports so TypeScript resolves the source modules while the emitted JavaScript remains valid native Node ESM.
