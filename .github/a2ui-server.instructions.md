---
applyTo: "packages/genui/server/**"
---

For the A2UI server agent, build the model system prompt through `buildA2UISystemPrompt()` in `agent/a2ui-prompt.ts`. The selected catalog is injected by rendering `renderCatalogReference(catalog)` into that prompt, and the same catalog id is passed into `buildHardRules(catalog.id)`. Request handlers should pass any request catalog through `pickChatOptions()` into `A2UIAgentService`; the service defaults to `BASIC_CATALOG`, includes a hash of the effective catalog contents in the agent cache key, and validates output with the same catalog.
