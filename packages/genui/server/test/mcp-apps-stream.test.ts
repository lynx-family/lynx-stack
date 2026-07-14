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

import { POST } from '../app/mcp-apps/stream/route.js';

interface MockMcpAppsService {
  generateRaw(
    messages: unknown,
    options: unknown,
    conversation: unknown,
    abortSignal?: AbortSignal,
  ): Promise<never>;
}

type GlobalWithMcpAppsService = typeof globalThis & {
  __MCP_APPS_AGENT_SERVICE__?: MockMcpAppsService;
};

function requestBody() {
  return {
    messages: [{ role: 'user', content: 'Show the weather' }],
    registry: {
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
        name: 'weather.current',
        inputSchema: { type: 'object' },
        _meta: { ui: { resourceUri: 'ui://weather/current' } },
      }],
      resources: [{
        uri: 'ui://weather/current',
        name: 'Current weather',
        mimeType: MCP_APPS_RESOURCE_MIME_TYPE,
      }],
    },
  };
}

describe('MCP Apps stream', () => {
  test('aborts model generation when the response reader disconnects', async () => {
    const global = globalThis as GlobalWithMcpAppsService;
    const previousService = global.__MCP_APPS_AGENT_SERVICE__;
    let receivedSignal: AbortSignal | undefined;
    global.__MCP_APPS_AGENT_SERVICE__ = {
      generateRaw(_messages, _options, _conversation, abortSignal) {
        receivedSignal = abortSignal;
        return new Promise((_resolve, reject) => {
          const rejectAbort = () => {
            reject(new DOMException('Generation aborted', 'AbortError'));
          };
          if (abortSignal?.aborted) {
            rejectAbort();
          } else {
            abortSignal?.addEventListener('abort', rejectAbort, { once: true });
          }
        });
      },
    };

    try {
      const response = await POST(
        new Request(
          'https://example.test/api/mcp-apps/stream',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': '203.0.113.41',
            },
            body: JSON.stringify(requestBody()),
          },
        ),
      );
      expect(response.status).toBe(200);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('response stream is unavailable');

      await reader.cancel('client disconnected');

      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      global.__MCP_APPS_AGENT_SERVICE__ = previousService;
    }
  });
});
