// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  MCP_APPS_EXTENSION_ID,
  MCP_APPS_PROTOCOL_VERSION,
  MCP_APPS_RESOURCE_MIME_TYPE,
  MCP_PROTOCOL_VERSION,
} from '@lynx-js/genui-mcp-apps/protocol';

const MAX_REGISTERED_TOOLS = 32;
const MAX_REGISTERED_RESOURCES = 32;

const inputSchemaValidator = new Ajv2020({
  addUsedSchema: false,
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: false,
  useDefaults: false,
  validateFormats: false,
});
const compiledInputSchemas = new WeakMap<
  Record<string, unknown>,
  ValidateFunction<unknown>
>();

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

export interface McpAppsResource {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: typeof MCP_APPS_RESOURCE_MIME_TYPE;
  _meta?: Record<string, unknown>;
}

export interface McpAppsClientRegistry {
  protocolVersion: string;
  appProtocolVersion: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    extensions: {
      [MCP_APPS_EXTENSION_ID]: {
        mimeTypes: string[];
      };
    };
  };
  tools: McpAppsTool[];
  resources: McpAppsResource[];
}

export type McpAppsAgentSelection =
  | {
    type: 'tool_call';
    name: string;
    arguments: Record<string, unknown>;
  }
  | {
    type: 'message';
    text: string;
  };

type ValidationResult =
  | { ok: true; registry: McpAppsClientRegistry }
  | { ok: false; status: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value ? value : undefined;
}

function describeSchemaErrors(errors: ErrorObject[] | null | undefined) {
  return inputSchemaValidator.errorsText(errors, {
    dataVar: 'arguments',
    separator: '; ',
  });
}

function compileInputSchema(
  schema: Record<string, unknown>,
): ValidateFunction<unknown> | string {
  const cached = compiledInputSchemas.get(schema);
  if (cached) return cached;

  try {
    const validate = inputSchemaValidator.compile(schema) as
      & ValidateFunction<unknown>
      & { $async?: true };
    if (validate.$async) {
      return 'asynchronous JSON Schemas are not supported';
    }
    compiledInputSchemas.set(schema, validate);
    return validate;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function toolResourceUri(tool: McpAppsTool): string | undefined {
  const modern = tool._meta.ui?.resourceUri;
  if (typeof modern === 'string') return modern;
  const legacy = tool._meta['ui/resourceUri'];
  return typeof legacy === 'string' ? legacy : undefined;
}

function toolIsVisibleTo(
  tool: McpAppsTool,
  audience: 'model' | 'app',
): boolean {
  return tool._meta.ui?.visibility?.includes(audience) ?? true;
}

function validateTool(value: unknown, index: number): McpAppsTool | string {
  if (!isRecord(value)) return `registry.tools[${index}] must be an object`;
  if (typeof value.name !== 'string' || !value.name) {
    return `registry.tools[${index}].name is required`;
  }
  if (!isRecord(value.inputSchema)) {
    return `registry.tools[${index}].inputSchema must be an object`;
  }
  const inputValidator = compileInputSchema(value.inputSchema);
  if (typeof inputValidator === 'string') {
    return `registry.tools[${index}].inputSchema is invalid: ${inputValidator}`;
  }
  if (!isRecord(value._meta)) {
    return `registry.tools[${index}]._meta must be an object`;
  }

  const ui = isRecord(value._meta.ui) ? value._meta.ui : undefined;
  if (
    ui?.visibility !== undefined
    && !Array.isArray(ui.visibility)
  ) {
    return `registry.tools[${index}]._meta.ui.visibility must be an array`;
  }
  const visibility = Array.isArray(ui?.visibility)
    ? ui.visibility
    : undefined;
  if (
    visibility?.some((item) => item !== 'model' && item !== 'app')
  ) {
    return `registry.tools[${index}]._meta.ui.visibility contains an invalid value`;
  }
  const tool: McpAppsTool = {
    name: value.name,
    inputSchema: value.inputSchema,
    _meta: {
      ...value._meta,
      ...(ui
        ? {
          ui: {
            ...(typeof ui.resourceUri === 'string'
              ? { resourceUri: ui.resourceUri }
              : {}),
            ...(visibility
              ? { visibility: visibility as Array<'model' | 'app'> }
              : {}),
          },
        }
        : {}),
    },
    ...(optionalString(value, 'title') ? { title: String(value.title) } : {}),
    ...(optionalString(value, 'description')
      ? { description: String(value.description) }
      : {}),
  };
  const resourceUri = toolResourceUri(tool);
  if (!resourceUri?.startsWith('ui://')) {
    return `registry.tools[${index}] must reference a ui:// resource in _meta.ui.resourceUri`;
  }
  return tool;
}

function validateResource(
  value: unknown,
  index: number,
): McpAppsResource | string {
  if (!isRecord(value)) {
    return `registry.resources[${index}] must be an object`;
  }
  if (typeof value.uri !== 'string' || !value.uri.startsWith('ui://')) {
    return `registry.resources[${index}].uri must use the ui:// scheme`;
  }
  if (typeof value.name !== 'string' || !value.name) {
    return `registry.resources[${index}].name is required`;
  }
  if (value.mimeType !== MCP_APPS_RESOURCE_MIME_TYPE) {
    return `registry.resources[${index}].mimeType must be ${MCP_APPS_RESOURCE_MIME_TYPE}`;
  }
  if (value._meta !== undefined && !isRecord(value._meta)) {
    return `registry.resources[${index}]._meta must be an object`;
  }

  return {
    uri: value.uri,
    name: value.name,
    mimeType: MCP_APPS_RESOURCE_MIME_TYPE,
    ...(optionalString(value, 'title') ? { title: String(value.title) } : {}),
    ...(optionalString(value, 'description')
      ? { description: String(value.description) }
      : {}),
    ...(isRecord(value._meta) ? { _meta: value._meta } : {}),
  };
}

export function validateMcpAppsClientRegistry(
  value: unknown,
): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, status: 400, error: 'registry is required' };
  }
  if (!isRecord(value.clientInfo)) {
    return { ok: false, status: 400, error: 'registry.clientInfo is required' };
  }
  if (value.protocolVersion !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      status: 400,
      error: `registry.protocolVersion must be ${MCP_PROTOCOL_VERSION}`,
    };
  }
  if (value.appProtocolVersion !== MCP_APPS_PROTOCOL_VERSION) {
    return {
      ok: false,
      status: 400,
      error: `registry.appProtocolVersion must be ${MCP_APPS_PROTOCOL_VERSION}`,
    };
  }
  if (
    typeof value.clientInfo.name !== 'string'
    || typeof value.clientInfo.version !== 'string'
  ) {
    return {
      ok: false,
      status: 400,
      error: 'registry.clientInfo must contain name and version',
    };
  }
  if (!Array.isArray(value.tools) || value.tools.length === 0) {
    return { ok: false, status: 400, error: 'registry.tools is required' };
  }
  if (value.tools.length > MAX_REGISTERED_TOOLS) {
    return {
      ok: false,
      status: 400,
      error: `too many registered tools (max ${MAX_REGISTERED_TOOLS})`,
    };
  }
  if (!Array.isArray(value.resources) || value.resources.length === 0) {
    return { ok: false, status: 400, error: 'registry.resources is required' };
  }
  if (value.resources.length > MAX_REGISTERED_RESOURCES) {
    return {
      ok: false,
      status: 400,
      error: `too many registered resources (max ${MAX_REGISTERED_RESOURCES})`,
    };
  }

  const capabilities = value.capabilities;
  const extensions = isRecord(capabilities)
      && isRecord(capabilities.extensions)
    ? capabilities.extensions
    : undefined;
  const uiCapability = extensions?.[MCP_APPS_EXTENSION_ID];
  const mimeTypes =
    isRecord(uiCapability) && Array.isArray(uiCapability.mimeTypes)
      ? uiCapability.mimeTypes.filter((item): item is string =>
        typeof item === 'string'
      )
      : [];
  if (!mimeTypes.includes(MCP_APPS_RESOURCE_MIME_TYPE)) {
    return {
      ok: false,
      status: 400,
      error:
        `registry must advertise ${MCP_APPS_EXTENSION_ID} with ${MCP_APPS_RESOURCE_MIME_TYPE}`,
    };
  }

  const tools: McpAppsTool[] = [];
  const toolNames = new Set<string>();
  for (const [index, item] of value.tools.entries()) {
    const tool = validateTool(item, index);
    if (typeof tool === 'string') {
      return { ok: false, status: 400, error: tool };
    }
    if (toolNames.has(tool.name)) {
      return {
        ok: false,
        status: 400,
        error: `registry.tools contains duplicate name ${tool.name}`,
      };
    }
    toolNames.add(tool.name);
    tools.push(tool);
  }

  const resources: McpAppsResource[] = [];
  const resourceUris = new Set<string>();
  for (const [index, item] of value.resources.entries()) {
    const resource = validateResource(item, index);
    if (typeof resource === 'string') {
      return { ok: false, status: 400, error: resource };
    }
    if (resourceUris.has(resource.uri)) {
      return {
        ok: false,
        status: 400,
        error: `registry.resources contains duplicate URI ${resource.uri}`,
      };
    }
    resourceUris.add(resource.uri);
    resources.push(resource);
  }

  for (const tool of tools) {
    const resourceUri = toolResourceUri(tool);
    if (!resourceUri || !resourceUris.has(resourceUri)) {
      return {
        ok: false,
        status: 400,
        error: `tool ${tool.name} references an unregistered UI resource`,
      };
    }
  }

  return {
    ok: true,
    registry: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      appProtocolVersion: MCP_APPS_PROTOCOL_VERSION,
      clientInfo: {
        name: value.clientInfo.name,
        version: value.clientInfo.version,
      },
      capabilities: {
        extensions: {
          [MCP_APPS_EXTENSION_ID]: { mimeTypes },
        },
      },
      tools,
      resources,
    },
  };
}

export function buildMcpAppsRegistrySystemMessage(
  registry: McpAppsClientRegistry,
): string {
  const tools = registry.tools
    .filter((tool) => toolIsVisibleTo(tool, 'model'))
    .map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      resourceUri: toolResourceUri(tool),
    }));
  return `The client registered these MCP Apps tools:\n${
    JSON.stringify(tools, null, 2)
  }`;
}

type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false };

function tryParseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function extractBalancedJsonObject(text: string): JsonParseResult {
  for (
    let start = text.indexOf('{');
    start >= 0;
    start = text.indexOf(
      '{',
      start + 1,
    )
  ) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index++) {
      const character = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          const parsed = tryParseJson(text.slice(start, index + 1));
          if (parsed.ok) return parsed;
          break;
        }
      }
    }
  }
  return { ok: false };
}

function extractFencedContent(text: string): string | undefined {
  const opening = text.indexOf('```');
  if (opening < 0) return undefined;
  const headerStart = opening + 3;
  const headerEnd = text.indexOf('\n', headerStart);
  if (headerEnd < 0) return undefined;
  const language = text.slice(headerStart, headerEnd).trim().toLowerCase();
  if (language && language !== 'json') return undefined;
  const closing = text.indexOf('```', headerEnd + 1);
  return closing < 0 ? undefined : text.slice(headerEnd + 1, closing).trim();
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct.ok) return direct.value;

  const fenced = extractFencedContent(trimmed);
  if (fenced) {
    const parsed = tryParseJson(fenced);
    if (parsed.ok) return parsed.value;
  }

  const embedded = extractBalancedJsonObject(trimmed);
  if (embedded.ok) return embedded.value;
  throw new Error('agent returned invalid JSON');
}

export function parseMcpAppsAgentSelection(
  text: string,
  registry: McpAppsClientRegistry,
): McpAppsAgentSelection {
  const parsed = extractJsonObject(text);
  if (!isRecord(parsed)) throw new Error('agent returned an invalid selection');
  if (parsed.type === 'message') {
    if (typeof parsed.text !== 'string' || !parsed.text.trim()) {
      throw new Error('agent returned an empty message');
    }
    return { type: 'message', text: parsed.text.trim() };
  }
  if (parsed.type !== 'tool_call') {
    throw new Error('agent selection type must be tool_call or message');
  }
  if (typeof parsed.name !== 'string') {
    throw new Error('agent tool selection is missing name');
  }
  const tool = registry.tools.find((candidate) =>
    candidate.name === parsed.name
  );
  if (!tool) throw new Error(`agent selected unknown tool ${parsed.name}`);
  if (!toolIsVisibleTo(tool, 'model')) {
    throw new Error(`agent selected app-only tool ${parsed.name}`);
  }
  if (!isRecord(parsed.arguments)) {
    throw new Error('agent tool arguments must be an object');
  }
  const validateArguments = compileInputSchema(tool.inputSchema);
  if (typeof validateArguments === 'string') {
    throw new Error(
      `tool ${tool.name} has an invalid inputSchema: ${validateArguments}`,
    );
  }
  if (!validateArguments(parsed.arguments)) {
    throw new Error(
      `agent tool arguments do not match inputSchema for ${tool.name}: ${
        describeSchemaErrors(validateArguments.errors)
      }`,
    );
  }
  return {
    type: 'tool_call',
    name: tool.name,
    arguments: parsed.arguments,
  };
}

export function parseMcpAppsAgentOutputs(
  finalText: string | undefined,
  streamedText: string,
  registry: McpAppsClientRegistry,
): McpAppsAgentSelection {
  const candidates = [finalText, streamedText].filter(
    (candidate, index, values): candidate is string =>
      typeof candidate === 'string'
      && candidate.trim().length > 0
      && values.indexOf(candidate) === index,
  );
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return parseMcpAppsAgentSelection(candidate, registry);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('agent returned no JSON output');
}

export function resolveMcpAppsResource(
  tool: McpAppsTool,
  registry: McpAppsClientRegistry,
): McpAppsResource {
  const resourceUri = toolResourceUri(tool);
  const resource = registry.resources.find((item) => item.uri === resourceUri);
  if (!resource) throw new Error(`UI resource is unavailable for ${tool.name}`);
  return resource;
}
