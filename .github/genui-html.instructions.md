---
applyTo: "packages/genui/html/**,packages/genui/server/{agent,app,service}/html/**,packages/genui/playground/src/pages/chat/html*"
---

Keep the standalone HTML generation prompt, source extraction, and document-envelope checks in `@lynx-js/genui-html`. Consume its public exports from Server and Playground; do not restore duplicate parser implementations or forwarding modules at the former server paths.

Keep this package dependency-free at runtime and usable in both Node.js and browsers. Model providers, tool registration, design guidance, SSE, and Bench orchestration belong to Server; iframe rendering and browser capture belong to Playground. HTML is directly executable source and does not need a build worker.

Preserve partial-source extraction for streaming and the distinction between lightweight preview completeness and strict final-envelope validation. These functions do not sanitize HTML. Preserve the existing Playground iframe sandbox and keep generated scripts out of server execution.

Cache `dist/**` in the package's Turbo build task and register its tests in the root Rstest configuration. Keep the package reachable from `packages/genui/tsconfig.json` for type-aware linting. Give exported build/test configurations explicit types so the repository's `isolatedDeclarations` check can validate the package without disabling that option.
