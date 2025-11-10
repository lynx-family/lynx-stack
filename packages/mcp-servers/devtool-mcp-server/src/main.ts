#!/usr/bin/env node

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defaultLogger } from '@lynx-js/debug-router-connector';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import pkg from '../package.json' with { type: 'json' };

async function main() {
  defaultLogger.setLevel('silent');
  const { setupServer } = await import('./index.ts');
  const mcpServer = new McpServer({
    name: 'Lynx DevTool',
    version: pkg.version,
  }, {
    instructions:
      `The Lynx DevTool MCP Server provides tools to interact with Lynx-based applications.

Glossary:
  1. Device: The DevTool MCP Server can connect to multiple devices (simulators or real devices).
  2. Client: A device can have multiple clients (Lynx applications) opened.
  3. Session: Each client may open multiple sessions (e.g., Lynx pages with same or different URLs).

Tool selection guidance:
  1. All tools have name '<DOMAIN>_<METHOD_NAME>'. <DOMAIN> is the domain of the tool, e.g., 'CSS', 'DOM', 'Debugger', 'Runtime', etc. Most of the tools would have the same functionality with Chrome DevTools Protocol. See documentation at: https://chromedevtools.github.io/devtools-protocol/tot/<DOMAIN>/#method-<METHOD_NAME>.

Tool usage guidance:
  1. Most of the tools would require a 'clientId' and a 'sessionId' parameter to identify the target client and session. You can get the list of connected devices, clients and sessions using the 'Device.listDevices', 'Device.listClients' and 'Device.listSessions' tools.
`,
  });

  setupServer(mcpServer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

await main();
