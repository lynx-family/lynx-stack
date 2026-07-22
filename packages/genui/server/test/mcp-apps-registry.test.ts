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
  parseMcpAppsAgentSelection,
  validateMcpAppsClientRegistry,
} from '../agent/mcp-apps-registry.js';
import type { McpAppsClientRegistry } from '../agent/mcp-apps-registry.js';

function createRegistry(
  inputSchema: Record<string, unknown>,
  secondaryInputSchema?: Record<string, unknown>,
): unknown {
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
    tools: [
      {
        name: 'weather.current',
        inputSchema,
        _meta: { ui: { resourceUri: 'ui://weather/current' } },
      },
      ...(secondaryInputSchema
        ? [{
          name: 'product.get',
          inputSchema: secondaryInputSchema,
          _meta: { ui: { resourceUri: 'ui://product/details' } },
        }]
        : []),
    ],
    resources: [
      {
        uri: 'ui://weather/current',
        name: 'Current weather',
        mimeType: MCP_APPS_RESOURCE_MIME_TYPE,
      },
      ...(secondaryInputSchema
        ? [{
          uri: 'ui://product/details',
          name: 'Product details',
          mimeType: MCP_APPS_RESOURCE_MIME_TYPE,
        }]
        : []),
    ],
  };
}

function validateRegistry(
  inputSchema: Record<string, unknown>,
): McpAppsClientRegistry {
  const validation = validateMcpAppsClientRegistry(
    createRegistry(inputSchema),
  );
  if (!validation.ok) throw new Error(validation.error);
  return validation.registry;
}

function toolCall(
  argumentsValue: Record<string, unknown>,
  name = 'weather.current',
): string {
  return JSON.stringify({
    type: 'tool_call',
    name,
    arguments: argumentsValue,
  });
}

describe('MCP Apps registry input schemas', () => {
  test('rejects invalid JSON Schema during registration', () => {
    const validation = validateMcpAppsClientRegistry(createRegistry({
      type: 'not-a-json-schema-type',
    }));

    expect(validation).toMatchObject({
      ok: false,
      status: 400,
    });
    if (validation.ok) return;
    expect(validation.error).toContain(
      'registry.tools[0].inputSchema is invalid',
    );
  });

  test('rejects asynchronous JSON Schema during registration', () => {
    const validation = validateMcpAppsClientRegistry(createRegistry({
      $async: true,
      type: 'object',
      properties: { city: { type: 'string' } },
    }));

    expect(validation).toMatchObject({
      ok: false,
      status: 400,
    });
    if (validation.ok) return;
    expect(validation.error).toContain(
      'asynchronous JSON Schemas are not supported',
    );
  });

  test('validates selected tool arguments without coercing values', () => {
    const registry = validateRegistry({
      type: 'object',
      properties: {
        days: { type: 'integer' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['days'],
      additionalProperties: false,
    });

    expect(() => parseMcpAppsAgentSelection(toolCall({}), registry)).toThrow(
      /do not match inputSchema/,
    );
    expect(() => parseMcpAppsAgentSelection(toolCall({ days: '3' }), registry))
      .toThrow(/do not match inputSchema/);
    expect(() =>
      parseMcpAppsAgentSelection(
        toolCall({ days: 3, unit: 'kelvin' }),
        registry,
      )
    ).toThrow(/do not match inputSchema/);
    expect(() =>
      parseMcpAppsAgentSelection(
        toolCall({ days: 3, unexpected: true }),
        registry,
      )
    ).toThrow(/do not match inputSchema/);
    expect(
      parseMcpAppsAgentSelection(
        toolCall({ days: 3, unit: 'celsius' }),
        registry,
      ),
    )
      .toEqual({
        type: 'tool_call',
        name: 'weather.current',
        arguments: { days: 3, unit: 'celsius' },
      });
  });

  test('uses the selected tool input schema', () => {
    const validation = validateMcpAppsClientRegistry(createRegistry(
      {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: { productId: { type: 'string' } },
        required: ['productId'],
        additionalProperties: false,
      },
    ));
    if (!validation.ok) throw new Error(validation.error);

    expect(() =>
      parseMcpAppsAgentSelection(
        toolCall({ city: 'Hangzhou' }, 'product.get'),
        validation.registry,
      )
    ).toThrow(/do not match inputSchema for product\.get/);
    expect(
      parseMcpAppsAgentSelection(
        toolCall({ productId: 'sku-1' }, 'product.get'),
        validation.registry,
      ),
    ).toMatchObject({
      type: 'tool_call',
      name: 'product.get',
      arguments: { productId: 'sku-1' },
    });
  });

  test('does not apply schema defaults to selected arguments', () => {
    const registry = validateRegistry({
      type: 'object',
      properties: { city: { type: 'string', default: 'Hangzhou' } },
      additionalProperties: false,
    });

    expect(parseMcpAppsAgentSelection(toolCall({}), registry)).toEqual({
      type: 'tool_call',
      name: 'weather.current',
      arguments: {},
    });
  });
});
