---
applyTo: "{packages/mcp-servers/**,pnpm-workspace.yaml}"
---

The `@lynx-js/docs-mcp-server` implementation and releases are maintained in `lynx-community/skills` under `packages/mcp-servers/docs-mcp-server`. Make documentation MCP server changes in that repository.

After removing an MCP server workspace, run `pnpm dedupe --lockfile-only` to update transitive dependency flags. Dependencies that remain reachable only through optional dependencies need `optional: true` in the lockfile snapshots. Verify the result with `pnpm dedupe --check --lockfile-only` and `pnpm peers check --lockfile-only`.

When removing the last package under a workspace directory, remove its glob from `pnpm-workspace.yaml`. Validate `upgrade-rspeedy` coverage with that directory absent, as in a clean checkout; ignored local build artifacts can keep the directory present and hide stale workspace entries.
