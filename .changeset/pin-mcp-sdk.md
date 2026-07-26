---
"@lynx-js/docs-mcp-server": patch
---

Pin `@modelcontextprotocol/sdk` to 1.25.2. 1.29.0 added a `types` condition to
its `./*` export wildcard, which resolves `server/mcp.js` to
`dist/esm/server/mcp.js.d.ts` — a file that does not exist, the real one being
`mcp.d.ts`. A caret range let any lockfile regeneration pull it in.
