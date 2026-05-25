---
applyTo: "packages/genui/Readme*.md"
---

When documenting the GenUI folder-level workflow, frame the happy path as Catalog -> Agent -> Client. Catalog docs should distinguish the client renderer catalog built with `defineCatalog` / `serializeCatalog` from the server agent's internal `A2UICatalog` prompt-reference format; do not imply the server accepts the client `SerializedCatalog` payload directly unless a conversion layer exists.

Assume the reader knows React but does not know A2UI. Introduce A2UI as a JSON message protocol for safely asking an agent to assemble approved ReactLynx components, and explain GenUI terms by mapping them back to familiar React ideas such as components, props, state updates, external stores, and event handlers.

When documenting GenUI transport implementations, describe the transport as the adapter between product state and `MessageStore`. Cover both REST and SSE paths, make the SSE `done` event the final validated render source, call out `AbortController` cancellation for prompt and action requests, and warn against passing provider credentials or endpoint overrides from untrusted browser clients.

When documenting GenUI CLI usage, use `npx @lynx-js/a2ui-cli` as the user-facing command prefix. Explain both command families: `generate catalog` for TypeScript-derived catalog artifacts and `generate prompt` for A2UI system prompts. Treat `@lynx-js/a2ui-catalog-extractor` as an internal implementation detail used by the catalog generation command, not as an external API or recommended binary, and remind readers that generated prompts and client catalogs must agree on component names and props.

Avoid literal wording such as "recommended shape" / "推荐形状" in user-facing docs. Prefer "interface best practice", "implementation pattern", "接口设计最佳实践", or other product-facing phrases that read naturally to React developers.
