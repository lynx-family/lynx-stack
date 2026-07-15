// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** MCP protocol version used by the GenUI MCP Apps integration. */
export const MCP_PROTOCOL_VERSION = '2025-11-25';

/** MCP Apps protocol version used by the GenUI integration. */
export const MCP_APPS_PROTOCOL_VERSION = '2026-01-26';

/** Stable MCP extension identifier for UI resources. */
export const MCP_APPS_EXTENSION_ID = 'io.modelcontextprotocol/ui';

/** MIME type used for MCP Apps UI resources. */
export const MCP_APPS_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/** Protocol metadata advertised by an MCP Apps server. */
export interface McpAppsProtocolMetadata {
  protocolVersion: string;
  appProtocolVersion: string;
  extensionId: string;
  resourceMimeType: string;
}

/** Metadata for the protocol versions supported by this package. */
export const MCP_APPS_PROTOCOL_METADATA: Readonly<McpAppsProtocolMetadata> = {
  protocolVersion: MCP_PROTOCOL_VERSION,
  appProtocolVersion: MCP_APPS_PROTOCOL_VERSION,
  extensionId: MCP_APPS_EXTENSION_ID,
  resourceMimeType: MCP_APPS_RESOURCE_MIME_TYPE,
};

/** JSON-RPC request or response identifier. */
export type McpJsonRpcId = string | number;

/** Tool registration supplied by an MCP Apps client. */
export interface McpAppsTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  _meta: Record<string, unknown> & {
    ui?: {
      resourceUri?: string;
      visibility?: Array<'model' | 'app'>;
    };
  };
}

/** UI resource registration supplied by an MCP Apps client. */
export interface McpAppsResource {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: string;
  _meta?: Record<string, unknown>;
}

/** Result returned by an MCP `tools/call` request. */
export interface McpCallToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/** MCP JSON-RPC `tools/call` request. */
export interface McpToolsCallRequest {
  jsonrpc: '2.0';
  id: McpJsonRpcId;
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Successful MCP JSON-RPC response. */
export interface McpJsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: McpJsonRpcId;
  result: Record<string, unknown>;
  error?: never;
}

/** Failed MCP JSON-RPC response. */
export interface McpJsonRpcErrorResponse {
  jsonrpc: '2.0';
  id?: McpJsonRpcId;
  result?: never;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** MCP JSON-RPC response with exactly one result or error branch. */
export type McpJsonRpcResponse =
  | McpJsonRpcSuccessResponse
  | McpJsonRpcErrorResponse;

/** MCP JSON-RPC notification. */
export interface McpJsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/** Successful output that selects and executes a registered MCP Apps tool. */
export interface McpAppsToolOutput {
  kind: 'tool';
  protocolVersion: string;
  toolCall: McpToolsCallRequest;
  toolResult: McpCallToolResult;
  tool: McpAppsTool;
  resource: McpAppsResource;
}

/** Text output returned when no MCP Apps tool is selected. */
export interface McpAppsMessageOutput {
  kind: 'message';
  protocolVersion: string;
  message: string;
}

/** Output returned by the GenUI MCP Apps router. */
export type McpAppsOutput = McpAppsToolOutput | McpAppsMessageOutput;

/** Client-owned tools, resources, and MCP Apps capabilities. */
export interface McpAppsClientRegistry {
  protocolVersion: string;
  appProtocolVersion: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    extensions: Record<string, { mimeTypes: string[] }>;
  };
  tools: McpAppsTool[];
  resources: McpAppsResource[];
}

/** Returns whether a value is a non-array object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isMcpJsonRpcId(value: unknown): value is McpJsonRpcId {
  return typeof value === 'string'
    || (typeof value === 'number' && Number.isInteger(value));
}

function hasOptionalString(
  record: Record<string, unknown>,
  key: string,
): boolean {
  return !hasOwn(record, key) || typeof record[key] === 'string';
}

/** Parses protocol metadata returned by an MCP Apps server. */
export function parseMcpAppsProtocolMetadata(
  value: unknown,
): McpAppsProtocolMetadata | null {
  if (!isRecord(value)) return null;
  const keys = [
    'protocolVersion',
    'appProtocolVersion',
    'extensionId',
    'resourceMimeType',
  ] as const;
  if (keys.some((key) => typeof value[key] !== 'string' || !value[key])) {
    return null;
  }
  return {
    protocolVersion: value['protocolVersion'] as string,
    appProtocolVersion: value['appProtocolVersion'] as string,
    extensionId: value['extensionId'] as string,
    resourceMimeType: value['resourceMimeType'] as string,
  };
}

/** Reads the modern or legacy UI resource URI from a tool registration. */
export function getToolResourceUri(tool: McpAppsTool): string | undefined {
  const modern = tool._meta.ui?.resourceUri;
  if (typeof modern === 'string') return modern;
  const legacy = tool._meta['ui/resourceUri'];
  return typeof legacy === 'string' ? legacy : undefined;
}

/** Returns whether a value is a valid MCP Apps tool registration. */
export function isMcpAppsTool(value: unknown): value is McpAppsTool {
  if (
    !isRecord(value)
    || typeof value['name'] !== 'string'
    || !value['name']
    || !hasOptionalString(value, 'title')
    || !hasOptionalString(value, 'description')
    || !isRecord(value['inputSchema'])
    || !isRecord(value['_meta'])
  ) {
    return false;
  }

  const meta = value['_meta'];
  if (hasOwn(meta, 'ui')) {
    const ui = meta['ui'];
    if (!isRecord(ui)) return false;
    if (
      hasOwn(ui, 'resourceUri')
      && (typeof ui['resourceUri'] !== 'string' || !ui['resourceUri'])
    ) {
      return false;
    }
    if (
      hasOwn(ui, 'visibility')
      && (
        !Array.isArray(ui['visibility'])
        || ui['visibility'].some((item) => item !== 'model' && item !== 'app')
      )
    ) {
      return false;
    }
  }

  return !hasOwn(meta, 'ui/resourceUri')
    || (typeof meta['ui/resourceUri'] === 'string'
      && Boolean(meta['ui/resourceUri']));
}

/** Returns whether a value is a valid MCP Apps UI resource registration. */
export function isMcpAppsResource(value: unknown): value is McpAppsResource {
  return isRecord(value)
    && typeof value['uri'] === 'string'
    && value['uri'].startsWith('ui://')
    && typeof value['name'] === 'string'
    && Boolean(value['name'])
    && hasOptionalString(value, 'title')
    && hasOptionalString(value, 'description')
    && value['mimeType'] === MCP_APPS_RESOURCE_MIME_TYPE
    && (!hasOwn(value, '_meta') || isRecord(value['_meta']));
}

/** Returns whether a value is a valid text-only MCP tool result. */
export function isMcpCallToolResult(
  value: unknown,
): value is McpCallToolResult {
  if (!isRecord(value) || !Array.isArray(value['content'])) return false;
  if (
    value['content'].some((item) =>
      !isRecord(item)
      || item['type'] !== 'text'
      || typeof item['text'] !== 'string'
    )
  ) {
    return false;
  }
  return (!hasOwn(value, 'structuredContent')
    || isRecord(value['structuredContent']))
    && (!hasOwn(value, 'isError') || typeof value['isError'] === 'boolean')
    && (!hasOwn(value, '_meta') || isRecord(value['_meta']));
}

/** Returns whether a value is an MCP JSON-RPC `tools/call` request. */
export function isMcpToolsCallRequest(
  value: unknown,
): value is McpToolsCallRequest {
  if (!isRecord(value) || value['jsonrpc'] !== '2.0') return false;
  if (!hasOwn(value, 'id') || !isMcpJsonRpcId(value['id'])) {
    return false;
  }
  if (
    value['method'] !== 'tools/call'
    || hasOwn(value, 'result')
    || hasOwn(value, 'error')
    || !isRecord(value['params'])
  ) {
    return false;
  }
  return typeof value['params']['name'] === 'string'
    && Boolean(value['params']['name'])
    && isRecord(value['params']['arguments']);
}

/** Returns whether a value is an MCP JSON-RPC notification. */
export function isMcpJsonRpcNotification(
  value: unknown,
): value is McpJsonRpcNotification {
  return isRecord(value)
    && value['jsonrpc'] === '2.0'
    && typeof value['method'] === 'string'
    && Boolean(value['method'])
    && !hasOwn(value, 'id')
    && !hasOwn(value, 'result')
    && !hasOwn(value, 'error')
    && (
      !hasOwn(value, 'params')
      || isRecord(value['params'])
    );
}

/** Returns whether a value is a successful or failed MCP JSON-RPC response. */
export function isMcpJsonRpcResponse(
  value: unknown,
): value is McpJsonRpcResponse {
  if (
    !isRecord(value)
    || value['jsonrpc'] !== '2.0'
    || hasOwn(value, 'method')
    || hasOwn(value, 'params')
  ) {
    return false;
  }

  const hasResult = hasOwn(value, 'result');
  const hasError = hasOwn(value, 'error');
  if (hasResult === hasError) return false;
  if (hasResult) {
    return hasOwn(value, 'id')
      && isMcpJsonRpcId(value['id'])
      && isRecord(value['result']);
  }

  if (hasOwn(value, 'id') && !isMcpJsonRpcId(value['id'])) return false;

  const error = value['error'];
  return isRecord(error)
    && typeof error['code'] === 'number'
    && Number.isInteger(error['code'])
    && typeof error['message'] === 'string';
}

/** Returns whether a value has the shape of an MCP JSON-RPC message. */
export function isMcpJsonRpcMessage(
  value: unknown,
): value is McpJsonRpcResponse | McpJsonRpcNotification | McpToolsCallRequest {
  return isMcpToolsCallRequest(value)
    || isMcpJsonRpcNotification(value)
    || isMcpJsonRpcResponse(value);
}

/** Parses a validated tool or message output from the MCP Apps router. */
export function parseMcpAppsOutput(
  value: unknown,
  appProtocolVersion?: string,
): McpAppsOutput | null {
  if (
    !isRecord(value)
    || typeof value['protocolVersion'] !== 'string'
    || !value['protocolVersion']
    || (
      appProtocolVersion !== undefined
      && value['protocolVersion'] !== appProtocolVersion
    )
  ) {
    return null;
  }
  if (
    value['kind'] === 'message'
    && typeof value['message'] === 'string'
  ) {
    return {
      kind: 'message',
      protocolVersion: value['protocolVersion'],
      message: value['message'],
    };
  }
  const toolCall = value['toolCall'];
  const toolResult = value['toolResult'];
  const tool = value['tool'];
  const resource = value['resource'];
  if (
    value['kind'] !== 'tool'
    || !isMcpToolsCallRequest(toolCall)
    || !isMcpCallToolResult(toolResult)
    || !isMcpAppsTool(tool)
    || !isMcpAppsResource(resource)
    || toolCall.params.name !== tool.name
    || getToolResourceUri(tool) !== resource.uri
  ) {
    return null;
  }
  return value as unknown as McpAppsToolOutput;
}
