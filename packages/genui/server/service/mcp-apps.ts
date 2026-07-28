// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { McpAppRegistry } from '../agent/mcp-apps';
import type { McpAppRegistration } from '../agent/mcp-apps';

const REGISTRY_KEY = '__MCP_APP_REGISTRY__';
type GlobalWithRegistry = typeof globalThis & {
  [REGISTRY_KEY]?: McpAppRegistry;
};

export function getMcpAppRegistry(): McpAppRegistry {
  const globalRegistry = globalThis as GlobalWithRegistry;
  globalRegistry[REGISTRY_KEY] ??= new McpAppRegistry();
  return globalRegistry[REGISTRY_KEY];
}

export function registerMcpApp(
  registration: McpAppRegistration,
): () => void {
  return getMcpAppRegistry().register(registration);
}
