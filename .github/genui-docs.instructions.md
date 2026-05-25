---
applyTo: "packages/genui/Readme*.md"
---

Write `packages/genui/Readme*.md` for external app developers who use A2UI from their own ReactLynx projects, not for contributors developing inside `lynx-stack`. Avoid monorepo setup, Turbo commands, package folder maps, private package names, local sample-server startup, localhost-only endpoints, and repository test commands in these user-facing docs.

When documenting the GenUI workflow, frame the happy path as Catalog -> Agent -> Client. Catalog docs should distinguish the client renderer catalog built with `defineCatalog` / `serializeCatalog` from whatever catalog-reference format an agent backend uses for prompts; do not imply the server accepts the client `SerializedCatalog` payload directly unless a conversion layer exists.

Assume the reader knows React but does not know A2UI. Introduce A2UI as a JSON message protocol for safely asking an agent to assemble approved ReactLynx components, and explain GenUI terms by mapping them back to familiar React ideas such as components, props, state updates, external stores, and event handlers.

When documenting GenUI transport implementations, describe the transport as the adapter between product state and `MessageStore`. Cover both REST and SSE paths, make the SSE `done` event the final validated render source, call out `AbortController` cancellation for prompt and action requests, and warn against passing provider credentials or endpoint overrides from untrusted browser clients.

When documenting GenUI CLI usage, use `npx @lynx-js/a2ui-cli` as the user-facing command prefix. Explain both command families: `generate catalog` for TypeScript-derived catalog artifacts and `generate prompt` for A2UI system prompts. Treat `@lynx-js/a2ui-catalog-extractor` as an internal implementation detail used by the catalog generation command, not as an external API or recommended binary, and remind readers that generated prompts and client catalogs must agree on component names and props.

When documenting the GenUI playground, only present the hosted URL `https://lynx-stack.dev/a2ui/` as the trial path. Do not document local `a2ui-playground` package usage, local server startup, or local playground endpoint overrides in user-facing docs; the package is not planned as a published product surface.

Avoid literal wording such as "recommended shape" / "推荐形状" in user-facing docs. Prefer "interface best practice", "implementation pattern", "接口设计最佳实践", or other product-facing phrases that read naturally to React developers.
