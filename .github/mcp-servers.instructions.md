---
applyTo: "packages/mcp-servers/**"
---

The `@lynx-js/docs-mcp-server` implementation and releases are maintained in `lynx-community/skills` under `packages/mcp-servers/docs-mcp-server`. Make documentation MCP server changes in that repository.

After removing an MCP server workspace, run `pnpm dedupe --lockfile-only` to update transitive dependency flags. Dependencies that remain reachable only through optional dependencies need `optional: true` in the lockfile snapshots. Verify the result with `pnpm dedupe --check --lockfile-only` and `pnpm peers check --lockfile-only`.
