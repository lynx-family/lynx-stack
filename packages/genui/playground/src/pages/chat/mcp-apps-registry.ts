// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  MCP_APPS_PROTOCOL_METADATA,
  parseMcpAppsProtocolMetadata,
} from '@lynx-js/genui/mcp-apps/protocol';
import type {
  McpAppsClientRegistry,
  McpAppsProtocolMetadata,
  McpAppsResource,
  McpAppsTool,
} from '@lynx-js/genui/mcp-apps/protocol';

import {
  PRODUCT_API,
  PRODUCT_RENDERER_ID,
} from '../../../lynx-src/mcp-apps/product/api.js';
import {
  WEATHER_API,
  WEATHER_RENDERER_ID,
} from '../../../lynx-src/mcp-apps/weather/api.js';

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

export interface McpAppsRegistration {
  metadata: McpAppsProtocolMetadata;
  registry: McpAppsClientRegistry;
}

const registrations = new Map<string, McpAppsRegistration>();
let activeRegistration: McpAppsRegistration = {
  metadata: MCP_APPS_PROTOCOL_METADATA,
  registry: createMcpAppsClientRegistry(MCP_APPS_PROTOCOL_METADATA),
};

function metadataEndpoint(streamEndpoint: string): string {
  const url = new URL(streamEndpoint);
  if (!/\/stream\/?$/u.test(url.pathname)) {
    throw new Error('MCP Apps stream endpoint must end with /stream');
  }
  url.pathname = url.pathname.replace(/\/stream\/?$/u, '/metadata');
  return url.toString();
}

export async function fetchMcpAppsRegistration(
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
    throw new Error('MCP Apps metadata request failed');
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

export function getActiveMcpAppsRegistration(): McpAppsRegistration {
  return activeRegistration;
}
