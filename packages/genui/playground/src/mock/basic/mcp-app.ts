// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getA2UIPlaygroundBaseUrl } from './lazy-component.js';
import {
  WEATHER_RENDERER_ID,
  callWeatherApi,
} from '../../../lynx-src/mcp-apps/weather/api.js';

export type McpAppBundlePlatform = 'web' | 'lynx';

export interface McpAppBundleUrlOptions {
  baseUrl: string;
  platform: McpAppBundlePlatform;
}

export interface McpAppDemoOptions {
  baseUrl: string;
}

export function buildMcpAppBundleUrl(
  options: McpAppBundleUrlOptions,
): string {
  const baseUrl = options.baseUrl.replace(/[?#].*$/u, '').replace(/\/$/u, '');
  return `${baseUrl}/mcp-apps.${options.platform}.js`;
}

export function createWeatherMcpAppData(): Record<string, unknown> {
  const input = { city: 'Hangzhou', unit: 'celsius' };
  return {
    renderer: WEATHER_RENDERER_ID,
    input,
    result: callWeatherApi(input),
  };
}

export function createMcpAppDemo(options: McpAppDemoOptions): unknown[] {
  const url = buildMcpAppBundleUrl({
    ...options,
    platform: 'lynx',
  });
  const webUrl = buildMcpAppBundleUrl({
    ...options,
    platform: 'web',
  });

  return [
    {
      createSurface: {
        surfaceId: 'default',
        catalogId: 'demo-mcp-app',
      },
    },
    {
      updateComponents: {
        surfaceId: 'default',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title', 'intro', 'mcp-app'],
            align: 'stretch',
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h2',
            text: 'MCP App in A2UI',
          },
          {
            id: 'intro',
            component: 'Text',
            variant: 'body',
            text:
              'The weather UI below runs as a separate Lynx bundle inside a frame. A2UI supplies its trusted resource URLs and render data.',
          },
          {
            id: 'mcp-app',
            component: 'McpApp',
            url,
            webUrl,
            autoWidth: true,
            autoHeight: true,
            height: 456,
            mcpAppData: createWeatherMcpAppData(),
          },
        ],
      },
    },
  ];
}

export const mcpAppDemo = createMcpAppDemo({
  baseUrl: getA2UIPlaygroundBaseUrl(),
});

export default mcpAppDemo;
