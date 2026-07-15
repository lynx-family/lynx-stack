// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_PROTOCOL_METADATA,
  MCP_APPS_RESOURCE_MIME_TYPE,
  getToolResourceUri,
  isMcpAppsResource,
  isMcpAppsTool,
  isMcpCallToolResult,
  isMcpJsonRpcMessage,
  isMcpJsonRpcNotification,
  isMcpJsonRpcResponse,
  isMcpToolsCallRequest,
  parseMcpAppsOutput,
  parseMcpAppsProtocolMetadata,
} from '../src/protocol.js';
import type { McpAppsTool } from '../src/protocol.js';

const VALID_TOOL = {
  name: 'weather.get_forecast',
  title: 'Weather forecast',
  description: 'Returns the current weather forecast.',
  inputSchema: {
    type: 'object',
    properties: { city: { type: 'string' } },
  },
  _meta: {
    ui: {
      resourceUri: 'ui://lynx/weather/current',
      visibility: ['model', 'app'],
    },
  },
};

const VALID_RESOURCE = {
  uri: 'ui://lynx/weather/current',
  name: 'Weather forecast',
  title: 'Weather card',
  description: 'Displays the current weather forecast.',
  mimeType: MCP_APPS_RESOURCE_MIME_TYPE,
  _meta: { theme: 'light' },
};

const VALID_TOOL_RESULT = {
  content: [{ type: 'text', text: 'Sunny, 21 C' }],
  structuredContent: { condition: 'sunny', temperature: 21 },
  isError: false,
  _meta: { requestId: 'weather-1' },
};

const VALID_TOOL_CALL = {
  jsonrpc: '2.0',
  id: 'weather-1',
  method: 'tools/call',
  params: {
    name: 'weather.get_forecast',
    arguments: { city: 'Paris' },
  },
};

const VALID_TOOL_OUTPUT = {
  kind: 'tool',
  protocolVersion: '2026-01-26',
  toolCall: VALID_TOOL_CALL,
  toolResult: VALID_TOOL_RESULT,
  tool: VALID_TOOL,
  resource: VALID_RESOURCE,
};

describe('MCP Apps protocol helpers', () => {
  test('exposes and parses the supported metadata', () => {
    expect(MCP_APPS_PROTOCOL_METADATA.extensionId).toBe(
      MCP_APPS_EXTENSION_ID,
    );
    expect(MCP_APPS_PROTOCOL_METADATA.resourceMimeType).toBe(
      MCP_APPS_RESOURCE_MIME_TYPE,
    );
    expect(parseMcpAppsProtocolMetadata(MCP_APPS_PROTOCOL_METADATA)).toEqual(
      MCP_APPS_PROTOCOL_METADATA,
    );
  });

  test('reads modern and legacy resource URI metadata', () => {
    const modern: McpAppsTool = {
      name: 'weather.get_forecast',
      inputSchema: {},
      _meta: { ui: { resourceUri: 'ui://lynx/weather/current' } },
    };
    const legacy: McpAppsTool = {
      name: 'weather.get_forecast',
      inputSchema: {},
      _meta: { 'ui/resourceUri': 'ui://lynx/weather/legacy' },
    };

    expect(getToolResourceUri(modern)).toBe('ui://lynx/weather/current');
    expect(getToolResourceUri(legacy)).toBe('ui://lynx/weather/legacy');
  });

  test('validates message output against an expected app protocol version', () => {
    const output = {
      kind: 'message',
      protocolVersion: '2026-01-26',
      message: 'What is Lynx?',
    };

    expect(parseMcpAppsOutput(output, '2026-01-26')).toEqual(output);
    expect(parseMcpAppsOutput(output, 'unsupported')).toBeNull();
  });

  test('validates tools, resources, and text-only tool results', () => {
    expect(isMcpAppsTool(VALID_TOOL)).toBe(true);
    expect(isMcpAppsResource(VALID_RESOURCE)).toBe(true);
    expect(isMcpCallToolResult(VALID_TOOL_RESULT)).toBe(true);
    expect(isMcpCallToolResult({ content: [] })).toBe(true);
  });

  test('rejects malformed tool registrations', () => {
    const malformedTools: unknown[] = [
      null,
      { ...VALID_TOOL, name: '' },
      { ...VALID_TOOL, title: 42 },
      { ...VALID_TOOL, description: null },
      { ...VALID_TOOL, inputSchema: [] },
      { ...VALID_TOOL, _meta: null },
      { ...VALID_TOOL, _meta: { ui: null } },
      {
        ...VALID_TOOL,
        _meta: { ui: { resourceUri: 42 } },
      },
      {
        ...VALID_TOOL,
        _meta: { ui: { visibility: ['assistant'] } },
      },
      {
        ...VALID_TOOL,
        _meta: { 'ui/resourceUri': 42 },
      },
    ];

    for (const tool of malformedTools) {
      expect(isMcpAppsTool(tool)).toBe(false);
    }
  });

  test('rejects malformed resource registrations', () => {
    const malformedResources: unknown[] = [
      null,
      { ...VALID_RESOURCE, uri: '' },
      { ...VALID_RESOURCE, uri: 'https://example.com/weather' },
      { ...VALID_RESOURCE, name: 42 },
      { ...VALID_RESOURCE, title: null },
      { ...VALID_RESOURCE, description: false },
      { ...VALID_RESOURCE, mimeType: '' },
      { ...VALID_RESOURCE, mimeType: 'text/html' },
      { ...VALID_RESOURCE, _meta: [] },
    ];

    for (const resource of malformedResources) {
      expect(isMcpAppsResource(resource)).toBe(false);
    }
  });

  test('rejects malformed and unsupported tool result content', () => {
    const malformedResults: unknown[] = [
      null,
      {},
      { content: {} },
      { content: [null] },
      { content: [{ type: 'text' }] },
      { content: [{ type: 'text', text: 42 }] },
      { content: [{ type: 'image', data: '...' }] },
      { content: [], structuredContent: [] },
      { content: [], isError: 'false' },
      { content: [], _meta: [] },
    ];

    for (const result of malformedResults) {
      expect(isMcpCallToolResult(result)).toBe(false);
    }
  });

  test('validates request, notification, and both response branches', () => {
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    };
    const successResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {},
    };
    const errorResponse = {
      jsonrpc: '2.0',
      id: 'weather-1',
      error: {
        code: -32602,
        message: 'Invalid params',
        data: { field: 'city' },
      },
    };
    const errorResponseWithoutId = {
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error',
      },
    };

    expect(isMcpToolsCallRequest(VALID_TOOL_CALL)).toBe(true);
    expect(isMcpJsonRpcNotification(notification)).toBe(true);
    expect(isMcpJsonRpcResponse(successResponse)).toBe(true);
    expect(isMcpJsonRpcResponse(errorResponse)).toBe(true);
    expect(isMcpJsonRpcResponse(errorResponseWithoutId)).toBe(true);
    expect(isMcpJsonRpcMessage(VALID_TOOL_CALL)).toBe(true);
    expect(isMcpJsonRpcMessage(notification)).toBe(true);
    expect(isMcpJsonRpcMessage(successResponse)).toBe(true);
    expect(isMcpJsonRpcMessage(errorResponse)).toBe(true);
    expect(isMcpJsonRpcMessage(errorResponseWithoutId)).toBe(true);
  });

  test('rejects invalid JSON-RPC branch shapes', () => {
    const malformedMessages: unknown[] = [
      { jsonrpc: '2.0', id: 1 },
      { jsonrpc: '2.0', id: 1, result: {}, error: null },
      { jsonrpc: '2.0', id: 1, result: null },
      { jsonrpc: '2.0', id: 1.5, result: {} },
      { jsonrpc: '2.0', id: 1, error: null },
      {
        jsonrpc: '2.0',
        id: 1,
        error: { code: '-32602', message: 'Invalid params' },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        error: { code: Number.NaN, message: 'Invalid params' },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602.5, message: 'Invalid params' },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 42 },
      },
      { jsonrpc: '2.0', id: Number.POSITIVE_INFINITY, result: {} },
      { jsonrpc: '2.0', id: 1, method: 'tools/call', result: {} },
      { jsonrpc: '2.0', method: '', params: {} },
      { jsonrpc: '2.0', method: 'notifications/initialized', params: 'ready' },
      { jsonrpc: '2.0', method: 'notifications/initialized', params: [] },
      { jsonrpc: '2.0', method: 'notifications/initialized', id: 1 },
      {
        ...VALID_TOOL_CALL,
        params: { ...VALID_TOOL_CALL.params, name: '' },
      },
      {
        ...VALID_TOOL_CALL,
        params: { ...VALID_TOOL_CALL.params, arguments: [] },
      },
      { ...VALID_TOOL_CALL, id: 1.5 },
      { ...VALID_TOOL_CALL, result: null },
    ];

    for (const message of malformedMessages) {
      expect(isMcpJsonRpcMessage(message)).toBe(false);
    }
  });

  test('parses a tool output only when every nested protocol value is valid', () => {
    expect(parseMcpAppsOutput(VALID_TOOL_OUTPUT, '2026-01-26')).toEqual(
      VALID_TOOL_OUTPUT,
    );

    const malformedOutputs: unknown[] = [
      { ...VALID_TOOL_OUTPUT, protocolVersion: '' },
      { ...VALID_TOOL_OUTPUT, toolCall: { jsonrpc: '2.0', id: 1 } },
      {
        ...VALID_TOOL_OUTPUT,
        toolResult: { content: [null] },
      },
      { ...VALID_TOOL_OUTPUT, tool: { ...VALID_TOOL, inputSchema: [] } },
      { ...VALID_TOOL_OUTPUT, resource: { ...VALID_RESOURCE, name: 42 } },
      {
        ...VALID_TOOL_OUTPUT,
        toolCall: {
          ...VALID_TOOL_CALL,
          params: { ...VALID_TOOL_CALL.params, name: 'product.get' },
        },
      },
      {
        ...VALID_TOOL_OUTPUT,
        resource: { ...VALID_RESOURCE, uri: 'ui://lynx/weather/other' },
      },
      {
        kind: 'message',
        protocolVersion: '2026-01-26',
        message: 42,
      },
    ];

    for (const output of malformedOutputs) {
      expect(parseMcpAppsOutput(output, '2026-01-26')).toBeNull();
    }
  });
});
