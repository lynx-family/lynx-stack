---
applyTo: "packages/genui/mcp-apps/**"
---

# GenUI MCP Apps

Keep ReactLynx rendering implementation under `src/render/`: `index.ts` owns the render entry exports, `McpApps.tsx` owns the host component, `data.ts` parses renderer input, `registry.ts` owns renderer lookup, `define.ts` owns renderer definitions, and `styles.css` owns host styles. Publish the entry as `./render`, copy its stylesheet to `dist/render/styles.css`, and preserve the package root exports as a compatibility facade.

Keep MCP protocol metadata and JSON-RPC contracts in the separate `src/protocol.ts` entry. Rendering code must remain protocol-agnostic and must not introduce Chat, agent, `NativeModules`, or browser message bridge dependencies.
