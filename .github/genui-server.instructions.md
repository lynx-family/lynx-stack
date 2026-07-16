---
applyTo: "packages/genui/server/**"
---

# GenUI Server Architecture

Keep protocol-neutral route infrastructure in `app/common`. Request-size enforcement, JSON parsing, chat and conversation validation, provider override selection, error and usage extraction, CORS, rate limiting, SSE encoding and headers, and stream logging must not live under a protocol route such as `app/a2ui`.

Keep shared agent-service contracts and helpers in `service/common`. `ChatMessage`, `ConversationContext`, generic provider options, provider agent caching, conversation assembly, model-message conversion, Mastra result extraction, and stream adaptation must not be imported from `service/a2ui-agent` by OpenUI or MCP Apps. Extend the generic options inside `service/a2ui-agent` only for A2UI-specific catalog and repair settings.

Use `app/common/sse.ts` for standard SSE frames and response headers. Pass event IDs or additional headers through its options instead of cloning the SSE framing and header literals in individual routes.

Build `genui-server` as an ESM Node.js service through `rslib.config.ts`. Keep protocol handlers based on standard Web `Request` and `Response`, register them in `src/routes.ts`, and keep Node HTTP stream conversion in `src/node-server.ts`. Do not introduce framework-specific request or response types into protocol routes.
