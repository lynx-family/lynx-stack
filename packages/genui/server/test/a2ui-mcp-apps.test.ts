// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_PROTOCOL_VERSION,
  MCP_APPS_RESOURCE_MIME_TYPE,
  MCP_PROTOCOL_VERSION,
} from '@lynx-js/genui-mcp-apps/protocol';

import {
  createA2UIMcpAppCatalogExtension,
  createA2UIMcpAppModelOutput,
  prepareA2UIMcpAppStep,
} from '../agent/a2ui-mcp-app-catalog.js';
import type { McpAppsClientRegistry } from '../agent/mcp-apps-registry.js';
import { McpAppRegistry, findMcpAppToolResult } from '../agent/mcp-apps.js';

const TOOL_NAME = 'example.lookup';
const RESOURCE_URI = 'ui://example/card';

function createClientRegistry(): McpAppsClientRegistry {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    appProtocolVersion: MCP_APPS_PROTOCOL_VERSION,
    clientInfo: { name: 'test-client', version: '1.0.0' },
    capabilities: {
      extensions: {
        [MCP_APPS_EXTENSION_ID]: {
          mimeTypes: [MCP_APPS_RESOURCE_MIME_TYPE],
        },
      },
    },
    tools: [{
      name: TOOL_NAME,
      description: 'Look up an example item.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
          visibility: ['model'],
        },
      },
    }],
    resources: [{
      uri: RESOURCE_URI,
      name: 'Example card',
      mimeType: MCP_APPS_RESOURCE_MIME_TYPE,
      _meta: {
        'lynxjs/template': {
          renderer: 'example',
          nativeBundle: './mcp-app.lynx.js',
          webBundle: './mcp-app.web.js',
        },
      },
    }],
  };
}

function createServerRegistry(): McpAppRegistry {
  const apps = new McpAppRegistry();
  apps.register({
    name: TOOL_NAME,
    resourceUri: RESOURCE_URI,
    execute: input => ({
      summary: `Loaded ${String(input.id)}.`,
      item: { id: input.id },
    }),
  });
  return apps;
}

function toolResultChunk(result: unknown) {
  return [{
    type: 'tool-result',
    payload: {
      toolCallId: 'call-1',
      toolName: 'mcp_apps_call',
      result,
    },
  }];
}

describe('A2UI MCP Apps tools', () => {
  test('exposes generic discovery tools without business tool names', () => {
    const apps = createServerRegistry();
    const clientRegistry = createClientRegistry();
    const extension = createA2UIMcpAppCatalogExtension(
      clientRegistry,
      apps,
    );

    expect(extension).toMatchObject({
      id: 'mcp-apps',
      component: 'McpApp',
    });
    expect(extension.systemAppendix).toContain(
      'Always call mcp_apps_list without a query',
    );
    expect(extension.systemAppendix).toContain(
      'If no listed app matches the request',
    );
    expect(extension.systemAppendix).toContain(
      'emit that component directly',
    );
    expect(Object.keys(extension.tools ?? {})).toEqual([
      'mcp_apps_list',
      'mcp_apps_get',
      'mcp_apps_call',
    ]);
    expect(prepareA2UIMcpAppStep({ stepNumber: 0 })).toEqual({
      toolChoice: { type: 'tool', toolName: 'mcp_apps_list' },
      activeTools: ['mcp_apps_list'],
    });
    expect(prepareA2UIMcpAppStep({ stepNumber: 1 })).toBeUndefined();
    expect(apps.list(clientRegistry)).toEqual([{
      name: TOOL_NAME,
      description: 'Look up an example item.',
      resourceUri: RESOURCE_URI,
    }]);
    expect(apps.get(clientRegistry, TOOL_NAME)).toMatchObject({
      name: TOOL_NAME,
      inputSchema: {
        type: 'object',
        required: ['id'],
      },
    });
  });

  test('returns registered tool data to the model as trusted McpApp props', async () => {
    const clientRegistry = createClientRegistry();
    const result = await createServerRegistry().call(
      clientRegistry,
      TOOL_NAME,
      { id: 'item-1' },
    );
    const toolResults = toolResultChunk(result);

    expect(findMcpAppToolResult(toolResults)).toMatchObject({
      toolName: TOOL_NAME,
      input: { id: 'item-1' },
    });
    expect(
      createA2UIMcpAppModelOutput(
        result,
        clientRegistry,
      ),
    ).toMatchObject({
      type: 'json',
      value: {
        summary: 'Loaded item-1.',
        mcpApp: {
          component: 'McpApp',
          props: {
            url: './mcp-app.lynx.js',
            webUrl: './mcp-app.web.js',
            autoHeight: true,
            height: 520,
            mcpAppData: {
              renderer: 'example',
              input: { id: 'item-1' },
              result: {
                summary: 'Loaded item-1.',
                item: { id: 'item-1' },
              },
            },
          },
        },
      },
    });
  });

  test('does not offer a McpApp component for unsafe bundle URLs', async () => {
    const clientRegistry = createClientRegistry();
    const result = await createServerRegistry().call(
      clientRegistry,
      TOOL_NAME,
      { id: 'item-1' },
    );
    const resource = clientRegistry.resources[0];
    if (!resource?._meta) throw new Error('missing test resource');
    resource._meta['lynxjs/template'] = {
      renderer: 'example',
      nativeBundle: 'javascript:alert(1)',
    };
    expect(
      createA2UIMcpAppModelOutput(result, clientRegistry),
    ).toEqual({
      type: 'json',
      value: {
        summary: 'Loaded item-1.',
        instruction:
          'The selected app did not resolve to a registered trusted A2UI template. Do not render a McpApp component; continue with a normal A2UI response.',
      },
    });
  });

  test('lets the model choose whether to emit a deferred host McpApp call', async () => {
    const clientRegistry = createClientRegistry();
    const result = await new McpAppRegistry().call(
      clientRegistry,
      TOOL_NAME,
      { id: 'item-3' },
    );

    expect(findMcpAppToolResult(toolResultChunk(result))).toBeNull();
    expect(
      createA2UIMcpAppModelOutput(result, clientRegistry),
    ).toMatchObject({
      type: 'json',
      value: {
        mcpApp: {
          component: 'McpApp',
          props: {
            url: './mcp-app.lynx.js',
            webUrl: './mcp-app.web.js',
            autoHeight: true,
            height: 520,
            mcpAppData: {
              renderer: 'example',
              input: { id: 'item-3' },
              toolCall: {
                jsonrpc: '2.0',
                id: result.callId,
                method: 'tools/call',
                params: {
                  name: TOOL_NAME,
                  arguments: { id: 'item-3' },
                },
              },
            },
          },
        },
      },
    });
  });

  test('supports runtime registration and validates client schemas', async () => {
    const apps = new McpAppRegistry();
    const unregister = apps.register({
      name: TOOL_NAME,
      resourceUri: RESOURCE_URI,
      execute: input => ({ item: { id: input.id } }),
    });
    const clientRegistry = createClientRegistry();

    expect(apps.list(clientRegistry, 'example')).toHaveLength(1);
    await expect(
      apps.call(clientRegistry, TOOL_NAME, { id: 'item-2' }),
    ).resolves.toMatchObject({
      toolName: TOOL_NAME,
      result: { item: { id: 'item-2' } },
    });
    await expect(
      apps.call(clientRegistry, TOOL_NAME, {}),
    ).rejects.toThrow('arguments do not match inputSchema');

    unregister();
    expect(apps.list(clientRegistry)).toHaveLength(1);
    await expect(
      apps.call(clientRegistry, TOOL_NAME, { id: 'item-2' }),
    ).resolves.toMatchObject({
      type: 'genui.mcp-app.tool-call',
      toolName: TOOL_NAME,
      input: { id: 'item-2' },
    });
  });
});
