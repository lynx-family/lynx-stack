# a2ui-prompt

Keep `packages/genui/server/agent` as the source of truth for built-in A2UI
prompt and catalog logic. Do not copy the built-in catalog JSON, prompt text, or
example definitions into this package.

This package may contain thin package-specific adapters such as
`readA2UICatalogFromDirectory`, but shared prompt rendering and built-in catalog
behavior should live in the server agent source and be re-exported from here.

The server package must remain self-contained for package-root Vercel
deployments. Do not make `packages/genui/server` depend on `@lynx-js/a2ui-prompt`
at runtime.

When editing exported functions or constants reachable through this package,
remember that `isolatedDeclarations` requires explicit types for exported APIs.

Run `pnpm -C packages/genui/a2ui-prompt build` after changing server agent
prompt/catalog sources or this package's adapter code. The CLI imports this
package through its published exports, so local CLI tests may need this build
step before changes are visible.
