// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { AppRenderData } from '@lynx-js/genui/mcp-apps';
import {
  getToolResourceUri,
  isMcpToolsCallRequest,
  isRecord,
  parseMcpAppsOutput,
  parseMcpAppsProtocolMetadata,
} from '@lynx-js/genui/mcp-apps/protocol';
import type {
  McpAppsClientRegistry,
  McpAppsOutput,
  McpAppsProtocolMetadata,
  McpAppsResource,
  McpAppsTool,
  McpAppsToolOutput,
  McpCallToolResult,
  McpToolsCallRequest,
} from '@lynx-js/genui/mcp-apps/protocol';

import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  filterProviderRequestOptionsForEndpoint,
  getChatEndpoint,
  parseTokenUsage,
  toProviderRequestOptions,
} from './shared.js';
import type { ProviderSettings } from './shared.js';
import type {
  ChatArtifact,
  ChatHydration,
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatStreamEmission,
  ChatStreamStep,
} from './type.js';
import {
  PRODUCT_API,
  PRODUCT_API_NAME,
  PRODUCT_RENDERER_ID,
  callProductApi,
  parseProductApiResult,
} from '../../../lynx-src/mcp-apps/product/api.js';
import type {
  ProductApiResult,
} from '../../../lynx-src/mcp-apps/product/api.js';
import {
  WEATHER_API,
  WEATHER_API_NAME,
  WEATHER_RENDERER_ID,
  callWeatherApi,
  parseWeatherApiResult,
} from '../../../lynx-src/mcp-apps/weather/api.js';
import type { WeatherApiResult } from '../../../lynx-src/mcp-apps/weather/api.js';
import type { ModelChatMessage } from '../../hooks/useConversation.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';

export interface McpAppsStreamState {
  generatedText: string;
  output?: McpAppsOutput;
}

export const WEATHER_RESOURCE_URI = 'ui://lynx/weather/current';
export const PRODUCT_RESOURCE_URI = 'ui://lynx/product/card';

const WEATHER_TOOL: McpAppsTool = {
  name: WEATHER_API.name,
  title: WEATHER_API.title,
  description: WEATHER_API.description,
  inputSchema: WEATHER_API.inputSchema,
  _meta: {
    ui: {
      resourceUri: WEATHER_RESOURCE_URI,
      visibility: ['model'],
    },
  },
};

const PRODUCT_TOOL: McpAppsTool = {
  name: PRODUCT_API.name,
  title: PRODUCT_API.title,
  description: PRODUCT_API.description,
  inputSchema: PRODUCT_API.inputSchema,
  _meta: {
    ui: {
      resourceUri: PRODUCT_RESOURCE_URI,
      visibility: ['model'],
    },
  },
};

function createWeatherResource(
  metadata: McpAppsProtocolMetadata,
): McpAppsResource {
  return {
    uri: WEATHER_RESOURCE_URI,
    name: 'lynx_weather_card',
    title: 'Lynx Weather Card',
    description:
      'Responsive Lynx weather card with current conditions and forecast.',
    mimeType: metadata.resourceMimeType,
    _meta: {
      ui: {
        prefersBorder: true,
        csp: {
          connectDomains: [],
          resourceDomains: [],
        },
      },
      'lynxjs/template': {
        renderer: WEATHER_RENDERER_ID,
        webBundle: './mcp-apps.web.js',
        nativeBundle: './mcp-apps.lynx.js',
      },
    },
  };
}

function createProductResource(
  metadata: McpAppsProtocolMetadata,
): McpAppsResource {
  return {
    uri: PRODUCT_RESOURCE_URI,
    name: 'lynx_product_card',
    title: 'Lynx Product Card',
    description:
      'Responsive Lynx product card with price, availability, refresh, and purchase actions.',
    mimeType: metadata.resourceMimeType,
    _meta: {
      ui: {
        prefersBorder: true,
        csp: {
          connectDomains: [],
          resourceDomains: ['https://images.unsplash.com'],
        },
      },
      'lynxjs/template': {
        renderer: PRODUCT_RENDERER_ID,
        webBundle: './mcp-apps.web.js',
        nativeBundle: './mcp-apps.lynx.js',
      },
    },
  };
}

function createMcpAppsClientRegistry(
  metadata: McpAppsProtocolMetadata,
): McpAppsClientRegistry {
  return {
    protocolVersion: metadata.protocolVersion,
    appProtocolVersion: metadata.appProtocolVersion,
    clientInfo: {
      name: 'lynx-genui-playground',
      version: '0.1.0',
    },
    capabilities: {
      extensions: {
        [metadata.extensionId]: {
          mimeTypes: [metadata.resourceMimeType],
        },
      },
    },
    tools: [WEATHER_TOOL, PRODUCT_TOOL],
    resources: [
      createWeatherResource(metadata),
      createProductResource(metadata),
    ],
  };
}

interface McpAppsRegistration {
  metadata: McpAppsProtocolMetadata;
  registry: McpAppsClientRegistry;
}

const registrations = new Map<string, McpAppsRegistration>();
let activeRegistration: McpAppsRegistration | null = null;

function metadataEndpoint(streamEndpoint: string): string {
  const url = new URL(streamEndpoint);
  if (!/\/stream\/?$/u.test(url.pathname)) {
    throw new Error('MCP Apps stream endpoint must end with /stream');
  }
  url.pathname = url.pathname.replace(/\/stream\/?$/u, '/metadata');
  return url.toString();
}

async function fetchRegistration(
  streamEndpoint: string,
  signal: AbortSignal,
): Promise<McpAppsRegistration> {
  const url = metadataEndpoint(streamEndpoint);
  const cached = registrations.get(url);
  if (cached) {
    activeRegistration = cached;
    return activeRegistration;
  }

  const response = await window.fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `MCP Apps metadata request failed: ${normalizeError(payload)}`,
    );
  }
  const metadata = parseMcpAppsProtocolMetadata(payload);
  if (!metadata) {
    throw new Error('MCP Apps metadata response is invalid');
  }
  activeRegistration = {
    metadata,
    registry: createMcpAppsClientRegistry(metadata),
  };
  registrations.set(url, activeRegistration);
  return activeRegistration;
}

function getActiveRegistration(): McpAppsRegistration {
  if (!activeRegistration) {
    throw new Error('MCP Apps protocol metadata has not been loaded');
  }
  return activeRegistration;
}

const WELCOME_MESSAGE: ChatMessageModel = {
  kind: 'assistant',
  text:
    'I can route requests to MCP Apps registered by this client. Ask for weather in any city or request a product card.',
};

const SUGGESTIONS = [
  {
    label: 'Weather Card',
    text: 'Show the weather in San Francisco in Fahrenheit.',
  },
  {
    label: 'Product Card',
    text: 'Show a product card for a limited-edition sneaker.',
  },
  {
    label: 'What is Lynx',
    text: 'What is Lynx? Show me the difference with React Native.',
  },
] as const;

function normalizeError(payload: unknown): string {
  if (isRecord(payload)) {
    if (typeof payload.error === 'string') return payload.error;
    if (isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
    if (typeof payload.message === 'string') return payload.message;
  }
  if (payload instanceof Error) return payload.message;
  return typeof payload === 'string' && payload
    ? payload
    : 'MCP Apps request failed';
}

function executeRegisteredMcpAppsTool(
  request: McpToolsCallRequest,
): McpCallToolResult {
  if (request.params.name === WEATHER_API_NAME) {
    const result = callWeatherApi(request.params.arguments);
    return {
      content: [{ type: 'text', text: result.summary }],
      structuredContent: { weather: result.weather },
      _meta: {
        'lynxjs/refresh': result.weather.refresh,
      },
    };
  }
  if (request.params.name === PRODUCT_API_NAME) {
    const result = callProductApi(request.params.arguments);
    return {
      content: [{ type: 'text', text: result.summary }],
      structuredContent: { product: result.product },
    };
  }
  return {
    isError: true,
    content: [{
      type: 'text',
      text: `Unknown registered MCP Apps tool: ${request.params.name}`,
    }],
  };
}

function resolveRegisteredToolOutput(
  request: McpToolsCallRequest,
  resourceValue?: unknown,
  registration = getActiveRegistration(),
): McpAppsToolOutput {
  const { metadata, registry } = registration;
  const tool = registry.tools.find((item) => item.name === request.params.name);
  if (!tool) {
    throw new Error(`Agent selected unregistered tool ${request.params.name}`);
  }
  if (!(tool._meta.ui?.visibility?.includes('model') ?? true)) {
    throw new Error(
      `Registered tool ${request.params.name} is not visible to model`,
    );
  }
  const resourceUri = getToolResourceUri(tool);
  const resource = registry.resources.find((item) => item.uri === resourceUri);
  if (!resource) {
    throw new Error(
      `Registered tool ${tool.name} has no registered UI resource`,
    );
  }
  if (
    resourceValue !== undefined
    && (!isRecord(resourceValue) || resourceValue.uri !== resource.uri)
  ) {
    throw new Error(
      'Agent returned a resource that does not match the registry',
    );
  }
  return {
    kind: 'tool',
    protocolVersion: metadata.appProtocolVersion,
    toolCall: request,
    toolResult: executeRegisteredMcpAppsTool(request),
    tool,
    resource,
  };
}

function normalizeDonePayload(payload: unknown): McpAppsOutput {
  if (!isRecord(payload)) throw new Error(normalizeError(payload));
  const registration = getActiveRegistration();
  if (payload.protocolVersion !== registration.metadata.appProtocolVersion) {
    throw new Error('MCP Apps agent returned an unsupported protocol version');
  }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return {
      kind: 'message',
      protocolVersion: registration.metadata.appProtocolVersion,
      message: payload.message.trim(),
    };
  }
  if (!isMcpToolsCallRequest(payload.toolCall)) {
    throw new Error('MCP Apps agent returned no valid tools/call request');
  }
  return resolveRegisteredToolOutput(
    payload.toolCall,
    payload.resource,
    registration,
  );
}

function streamStep(
  state: McpAppsStreamState,
  emissions: readonly ChatStreamEmission<McpAppsOutput>[] = [],
): ChatStreamStep<McpAppsStreamState, McpAppsOutput> {
  return { state, emissions };
}

const MCP_APPS_STREAM = {
  initial(): McpAppsStreamState {
    return { generatedText: '' };
  },
  reduce(
    state: McpAppsStreamState,
    frame: { event: string; data: unknown },
  ): ChatStreamStep<McpAppsStreamState, McpAppsOutput> {
    if (frame.event === 'error') throw new Error(normalizeError(frame.data));
    if (frame.event === 'delta') {
      const text = isRecord(frame.data) && typeof frame.data.text === 'string'
        ? frame.data.text
        : '';
      if (!text) return streamStep(state);
      const generatedText = state.generatedText + text;
      return streamStep({ ...state, generatedText }, [{
        type: 'progress',
        text: generatedText,
      }]);
    }
    if (frame.event !== 'done') return streamStep(state);

    const output = normalizeDonePayload(frame.data);
    const emissions: ChatStreamEmission<McpAppsOutput>[] = [];
    const usage = isRecord(frame.data)
      ? parseTokenUsage(frame.data.usage)
      : null;
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep({ ...state, output }, emissions);
  },
  fromJson(payload: unknown) {
    const output = normalizeDonePayload(payload);
    const emissions: ChatStreamEmission<McpAppsOutput>[] = [];
    const usage = isRecord(payload) ? parseTokenUsage(payload.usage) : null;
    if (usage) emissions.push({ type: 'usage', usage });
    emissions.push({ type: 'final', output });
    return streamStep({ generatedText: '', output }, emissions);
  },
  finish(state: McpAppsStreamState): McpAppsOutput | null {
    return state.output ?? null;
  },
  error: normalizeError,
};

function outputMessage(output: McpAppsOutput): ChatMessageModel {
  return {
    kind: 'output',
    tone: 'success',
    text: output.kind === 'tool' ? 'MCP Apps Tool Result' : 'Agent response',
    payload: output.kind === 'tool' ? output.toolResult : output.message,
    payloadLayout: 'single',
  };
}

function toolCallMessage(output: McpAppsToolOutput): ChatMessageModel {
  return {
    kind: 'output',
    tone: 'info',
    text: 'LLM Tool Call',
    payload: {
      type: 'tool_call',
      name: output.toolCall.params.name,
      arguments: output.toolCall.params.arguments,
    },
    payloadLayout: 'single',
  };
}

function successMessage(output: McpAppsOutput): ChatMessageModel {
  return output.kind === 'tool'
    ? {
      kind: 'status',
      tone: 'success',
      icon: 'sparkles',
      text: `Called ${output.tool.name} and rendered ${output.resource.uri}.`,
    }
    : { kind: 'assistant', text: output.message };
}

function transcriptMessages(output: McpAppsOutput): ChatMessageModel[] {
  return output.kind === 'tool'
    ? [toolCallMessage(output), successMessage(output), outputMessage(output)]
    : [successMessage(output), outputMessage(output)];
}

function parsePersistedOutput(content: string): McpAppsOutput | null {
  try {
    return parseMcpAppsOutput(JSON.parse(content) as unknown);
  } catch {
    return null;
  }
}

function lastMetrics(
  history: readonly ModelChatMessage[],
): PreviewPerformanceMetrics | undefined {
  for (let index = history.length - 1; index >= 0; index--) {
    const metrics = history[index]?.previewMetrics;
    if (metrics) return metrics;
  }
  return undefined;
}

function hydrate(
  history: readonly ModelChatMessage[],
  previewMessages: readonly unknown[],
): ChatHydration<McpAppsOutput> {
  const messages: ChatMessageModel[] = [{ ...WELCOME_MESSAGE }];
  let output: McpAppsOutput | null = null;
  for (const message of history) {
    if (message.role === 'user') {
      messages.push({ kind: 'user', text: message.content });
      continue;
    }
    if (message.role !== 'assistant') continue;
    const parsed = parsePersistedOutput(message.content);
    if (!parsed) continue;
    output = parsed;
    messages.push(...transcriptMessages(parsed));
  }
  for (let index = previewMessages.length - 1; index >= 0; index--) {
    const parsed = parseMcpAppsOutput(previewMessages[index]);
    if (parsed) {
      output = parsed;
      break;
    }
  }
  const metrics = lastMetrics(history);
  return {
    messages,
    output,
    ...(metrics ? { metrics } : {}),
  };
}

function createArtifact(output: McpAppsOutput): ChatArtifact {
  return {
    title: output.kind === 'tool'
      ? 'MCP Apps Exchange'
      : 'MCP Agent Message',
    meta: `MCP Apps ${output.protocolVersion}`,
    views: [{
      id: 'json',
      label: 'JSON',
      text: JSON.stringify(output, null, 2),
      language: 'json',
    }],
  };
}

function weatherRenderData(
  output: McpAppsToolOutput,
): AppRenderData<WeatherApiResult> {
  const text = output.toolResult.content.find((item) => item.type === 'text')
    ?.text ?? '';
  const weather = output.toolResult.structuredContent?.weather;
  const result = parseWeatherApiResult({ summary: text, weather });
  if (!result) throw new Error('Weather tool returned invalid renderer data');
  return {
    renderer: WEATHER_RENDERER_ID,
    input: output.toolCall.params.arguments,
    result,
  };
}

function productRenderData(
  output: McpAppsToolOutput,
): AppRenderData<ProductApiResult> {
  const text = output.toolResult.content.find((item) => item.type === 'text')
    ?.text ?? '';
  const product = output.toolResult.structuredContent?.product;
  const result = parseProductApiResult({
    summary: text,
    product,
  }) ?? callProductApi(output.toolCall.params.arguments);
  return {
    renderer: PRODUCT_RENDERER_ID,
    input: output.toolCall.params.arguments,
    result,
  };
}

function appRenderData(output: McpAppsToolOutput): AppRenderData {
  if (output.tool.name === WEATHER_API_NAME) return weatherRenderData(output);
  if (output.tool.name === PRODUCT_API_NAME) {
    return productRenderData(output);
  }
  throw new Error(`No renderer data adapter for ${output.tool.name}`);
}

export const MCP_APPS_CHAT_ADAPTER = {
  id: 'mcp-apps',
  copy: {
    description:
      'Register local MCP Apps, let the agent select a tool, and render its ui:// resource with a Lynx template.',
    inputAriaLabel: 'Ask a registered MCP Apps for information',
    inputPlaceholder: 'Ask for weather or a product card...',
    agentLabel: 'MCP Apps Agent',
    progressLabel: 'Routing request to a registered MCP Apps...',
    failurePrefix: 'MCP Apps request failed:',
  },
  suggestions: SUGGESTIONS,
  settings: CHAT_PROVIDER_SETTINGS_ADAPTER,
  async createRequest({ prompt, conversation, settings, host, signal }) {
    const url = getChatEndpoint('mcp-apps', host);
    const registration = await fetchRegistration(url, signal);
    const provider = filterProviderRequestOptionsForEndpoint(
      toProviderRequestOptions(settings),
      url,
      host,
    );
    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: {
        resourceId: 'mcp-apps-create',
        messages: [{ role: 'user', content: prompt }],
        conversation,
        registry: registration.registry,
        ...provider,
      },
    };
  },
  stream: MCP_APPS_STREAM,
  hydrate({ history, previewMessages }) {
    return hydrate(history, previewMessages);
  },
  persist(output) {
    return {
      assistantContent: JSON.stringify(output),
      a2uiMessages: [],
      previewMessages: output.kind === 'tool' ? [output] : [],
    };
  },
  transcript: {
    pending() {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: 'Routing request to a registered MCP Apps...',
      };
    },
    progress(text) {
      return {
        kind: 'status',
        tone: 'pending',
        icon: 'spinner',
        text: `Selecting a registered MCP Apps (${text.length} chars)...`,
      };
    },
    success(output) {
      return transcriptMessages(output);
    },
    failure(error) {
      return {
        kind: 'status',
        tone: 'error',
        icon: 'error',
        text: `MCP Apps request failed: ${error}`,
      };
    },
  },
  examples: {
    items: [] as readonly never[],
    item(_example: never) {
      throw new Error('MCP Apps examples are not available');
    },
    load(_example: never) {
      throw new Error('MCP Apps examples are not available');
    },
  },
  preview: {
    delivery: 'reload',
    source(output, context) {
      if (!output) return undefined;
      return {
        kind: 'mcp-apps',
        mcpAppData: output.kind === 'tool'
          ? appRenderData(output)
          : { markdown: output.message },
        theme: context.theme,
      };
    },
    artifact: createArtifact,
    merge(_current, next) {
      return next;
    },
    emptyTitle: 'Ask a registered MCP Apps',
    emptySubtitle: 'The selected ui:// resource will render here',
    generatingHint:
      'The agent is selecting from the tools registered by this client.',
    emptyHint:
      'No MCP Apps resource has been selected yet. Ask for weather or a sneaker product card.',
  },
} satisfies ChatProtocolAdapter<
  McpAppsOutput,
  McpAppsStreamState,
  ProviderSettings
>;
