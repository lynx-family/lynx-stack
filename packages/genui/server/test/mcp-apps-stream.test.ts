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

import type { ChatOptions } from '../service/common/types.js';
import app from '../src/app.js';

interface MockMcpAppsService {
  generateRaw(
    messages: unknown,
    options: ChatOptions,
    conversation: unknown,
    abortSignal?: AbortSignal,
  ): Promise<unknown>;
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
  test('includes returned reasoning when the model fails', async () => {
    const global = globalThis as GlobalWithMcpAppsService;
    const previousService = global.__MCP_APPS_AGENT_SERVICE__;
    global.__MCP_APPS_AGENT_SERVICE__ = {
      generateRaw(_messages, opts) {
        opts.onReasoning?.('Routing reasoning');
        opts.onPerformanceEvent?.('agent.model.first_text_token', {
          invocationId: 'mcp-routing',
          durationMs: 40,
        });
        opts.onPerformanceEvent?.('agent.model.error', {
          invocationId: 'mcp-routing',
          durationMs: 44,
        });
        return Promise.reject(new Error('Model failed'));
      },
    };
    try {
      const response = await app.request('/mcp-apps/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.214',
        },
        body: JSON.stringify(requestBody()),
      });
      const body = await response.text();
      expect(body).toContain('event: error');
      expect(body).toContain(
        '"reasoning":{"text":"Routing reasoning","truncated":false}',
      );
      const frame = body.split('\n\n').find(frame =>
        frame.startsWith('event: error\n')
      );
      const payload = JSON.parse(
        frame!.slice('event: error\ndata: '.length),
      ) as {
        metrics: {
          generationMs: unknown;
          firstTextTokenMs: unknown;
          modelMs: unknown;
        };
      };
      expect(payload.metrics.generationMs).toBeTypeOf('number');
      expect(payload.metrics.firstTextTokenMs).toBeTypeOf('number');
      expect(payload.metrics.modelMs).toBe(44);
    } finally {
      global.__MCP_APPS_AGENT_SERVICE__ = previousService;
    }
  });

  test.each([
    { type: 'message', text: 'Hello' },
    { type: 'tool_call', name: 'weather.current', arguments: {} },
  ])('returns priced token dimensions for %j', async selection => {
    const global = globalThis as GlobalWithMcpAppsService;
    const previousService = global.__MCP_APPS_AGENT_SERVICE__;
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 20,
      prompt_tokens_details: { cached_tokens: 60 },
    };
    global.__MCP_APPS_AGENT_SERVICE__ = {
      generateRaw: () =>
        Promise.resolve({
          text: JSON.stringify(selection),
          usage,
          finishReason: 'stop',
        }),
    };
    try {
      const response = await app.request('/mcp-apps/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.183',
        },
        body: JSON.stringify(requestBody()),
      });
      const body = await response.text();
      expect(body).toMatch(/"metrics":\{"generationMs":\d/u);
      const frame = body.split('\n\n').find(frame =>
        frame.startsWith('event: done\n')
      );
      expect(frame).toBeDefined();
      expect(JSON.parse(frame!.slice('event: done\ndata: '.length)))
        .toMatchObject({
          usage,
          tokenUsage: {
            inputTokens: 100,
            cachedTokens: 60,
            outputTokens: 20,
            totalTokens: 120,
          },
        });
    } finally {
      global.__MCP_APPS_AGENT_SERVICE__ = previousService;
    }
  });

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
      const response = await app.request(
        '/mcp-apps/stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.41',
          },
          body: JSON.stringify(requestBody()),
        },
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
