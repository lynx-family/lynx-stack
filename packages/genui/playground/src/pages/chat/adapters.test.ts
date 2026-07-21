// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rs, test } from '@rstest/core';

import { A2UI_CHAT_ADAPTER } from './a2ui.js';
import {
  MCP_APPS_CHAT_ADAPTER,
  PRODUCT_RESOURCE_URI,
  WEATHER_RESOURCE_URI,
} from './mcp-apps.js';
import { OPENUI_CHAT_ADAPTER } from './openui.js';
import { PRODUCT_API_NAME } from '../../../lynx-src/mcp-apps/product/api.js';
import { WEATHER_API_NAME } from '../../../lynx-src/mcp-apps/weather/api.js';
import { PROTOCOLS } from '../../utils/protocol.js';

const reduceA2UIStream = A2UI_CHAT_ADAPTER.stream.reduce.bind(
  A2UI_CHAT_ADAPTER.stream,
);
const reduceOpenUIStream = OPENUI_CHAT_ADAPTER.stream.reduce.bind(
  OPENUI_CHAT_ADAPTER.stream,
);

describe('chat protocol adapters', () => {
  test('reduces an A2UI stream without duplicating incremental messages', () => {
    let state = A2UI_CHAT_ADAPTER.stream.initial();

    const delta = reduceA2UIStream(state, {
      event: 'delta',
      data: { text: '{"begin":' },
    });
    state = delta.state;
    expect(delta.emissions).toEqual([
      { type: 'progress', text: '{"begin":' },
    ]);

    const firstMessage = { createSurface: { surfaceId: 'main' } };
    const first = reduceA2UIStream(state, {
      event: 'message',
      data: { messages: [firstMessage] },
    });
    state = first.state;
    expect(first.emissions).toEqual([
      { type: 'partial', output: [firstMessage] },
    ]);

    const secondMessage = { updateComponents: { surfaceId: 'main' } };
    const second = reduceA2UIStream(state, {
      event: 'message',
      data: { messages: [secondMessage] },
    });
    state = second.state;
    expect(second.emissions).toEqual([
      { type: 'partial', output: [secondMessage] },
    ]);
    expect(state.messages).toEqual([firstMessage, secondMessage]);

    const finalMessages = [firstMessage, secondMessage, {
      updateDataModel: { surfaceId: 'main' },
    }];
    const done = reduceA2UIStream(state, {
      event: 'done',
      data: {
        validation: { messages: finalMessages },
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        preview: {
          messagesUrl: 'https://example.com/messages.json',
          actionMocksUrl: 'https://example.com/actions.json',
        },
      },
    });

    expect(done.state.messages).toEqual(finalMessages);
    expect(done.emissions).toEqual([
      {
        type: 'usage',
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
      },
      {
        type: 'previewPayload',
        value: {
          messagesUrl: 'https://example.com/messages.json',
          actionMocksUrl: 'https://example.com/actions.json',
        },
      },
      { type: 'final', output: finalMessages },
    ]);
  });

  test('surfaces A2UI validation errors when no output is available', () => {
    expect(() =>
      reduceA2UIStream(
        A2UI_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: { validation: { errors: ['bad schema'] } },
        },
      )
    ).toThrow('bad schema');
  });

  test('reduces OpenUI create and action streams independently', () => {
    let state = OPENUI_CHAT_ADAPTER.stream.initial();
    state = reduceOpenUIStream(state, {
      event: 'delta',
      data: { text: 'root = ' },
    }).state;
    state = reduceOpenUIStream(state, {
      event: 'delta',
      data: { text: 'Stack([])' },
    }).state;

    const done = reduceOpenUIStream(state, {
      event: 'done',
      data: {
        usage: { prompt_tokens: 4, completion_tokens: 6 },
      },
    });
    const output = {
      rawText: 'root = Stack([])',
      scenarioTitle: 'Agent response',
    };
    expect(done.emissions).toEqual([
      { type: 'progress', text: output.rawText },
      {
        type: 'usage',
        usage: { promptTokens: 4, completionTokens: 6, totalTokens: 10 },
      },
      { type: 'final', output },
    ]);

    const action = OPENUI_CHAT_ADAPTER.action.stream.fromJson({
      text: 'root = Text({text: "Saved"})',
    });
    expect(action.emissions).toEqual([
      { type: 'progress', text: 'root = Text({text: "Saved"})' },
      {
        type: 'final',
        output: {
          rawText: 'root = Text({text: "Saved"})',
          scenarioTitle: 'Action response',
        },
      },
    ]);
  });

  test('builds protocol-specific preview sources and merge behavior', () => {
    const a2uiOutput = [{ createSurface: { surfaceId: 'main' } }];
    expect(A2UI_CHAT_ADAPTER.preview.source(a2uiOutput, {
      protocol: PROTOCOLS.a2ui,
      theme: 'dark',
      previewPayloadUrls: {
        messagesUrl: 'https://example.com/messages.json',
        actionMocksUrl: 'https://example.com/actions.json',
      },
    })).toMatchObject({
      kind: 'a2ui',
      protocol: PROTOCOLS.a2ui,
      theme: 'dark',
      messages: a2uiOutput,
      messagesUrl: 'https://example.com/messages.json',
      actionMocksUrl: 'https://example.com/actions.json',
      liveAction: true,
    });
    expect(A2UI_CHAT_ADAPTER.preview.merge([], a2uiOutput)).toEqual(
      a2uiOutput,
    );
    expect(A2UI_CHAT_ADAPTER.persist(
      [{ updateDataModel: { surfaceId: 'main' } }],
      {
        kind: 'action',
        current: a2uiOutput,
        previewPayloadUrls: {
          messagesUrl: 'https://example.com/action-messages.json',
        },
      },
    )).toMatchObject({
      previewMessages: [
        ...a2uiOutput,
        { updateDataModel: { surfaceId: 'main' } },
      ],
      previewPayloadUrls: null,
      snapshotPreviewPayloadUrls: null,
    });
    expect(A2UI_CHAT_ADAPTER.preview.source(null, {
      protocol: PROTOCOLS.a2ui,
      theme: 'light',
      previewPayloadUrls: null,
    })).toBeUndefined();

    const openuiOutput = {
      rawText: 'root = Stack([])',
      scenarioTitle: 'Example',
    };
    expect(OPENUI_CHAT_ADAPTER.preview.source(openuiOutput, {
      protocol: PROTOCOLS.openui,
      theme: 'dark',
      previewPayloadUrls: null,
    })).toEqual({
      kind: 'openui',
      rawText: openuiOutput.rawText,
      theme: 'dark',
      liveAction: true,
    });
    expect(OPENUI_CHAT_ADAPTER.preview.merge(null, openuiOutput)).toBe(
      openuiOutput,
    );
    expect(OPENUI_CHAT_ADAPTER.preview.source(null, {
      protocol: PROTOCOLS.openui,
      theme: 'light',
      previewPayloadUrls: null,
    })).toBeUndefined();
  });

  test('parses A2UI action bridge messages', () => {
    const action = A2UI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'A2UI_USER_ACTION',
      action: { name: 'refresh', surfaceId: 'main' },
    });
    expect(action).toEqual({
      action: { name: 'refresh', surfaceId: 'main' },
      surfaceId: 'main',
    });
    expect(A2UI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'OPENUI_USER_ACTION',
      action: { name: 'refresh' },
    })).toBeNull();
    expect(A2UI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'A2UI_USER_ACTION',
    })).toBeNull();
  });

  test('parses OpenUI action bridge messages and preserves form context', () => {
    const event = {
      type: 'submit',
      params: { orderId: 42 },
      humanFriendlyMessage: 'Submit order',
      formName: 'checkout',
      formState: { size: 'large' },
    };
    const action = OPENUI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'OPENUI_USER_ACTION',
      action: event,
    });
    expect(action).toEqual(event);
    expect(OPENUI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'A2UI_USER_ACTION',
      event,
    })).toEqual(event);
    expect(OPENUI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'OPENUI_USER_ACTION',
      action: { type: 'submit', params: {} },
    })).toBeNull();

    const userText = OPENUI_CHAT_ADAPTER.action.userText(event);
    expect(userText).toContain('Submit order');
    expect(userText).toContain('"orderId": 42');
    expect(userText).toContain('"formName": "checkout"');
    expect(userText).toContain('"size": "large"');
  });

  test('loads MCP Apps metadata before registering tools', async () => {
    const host = {
      origin: 'https://example.com',
      hostname: 'example.com',
      protocol: 'https:',
      search: '',
      baseUrl: 'https://example.com/',
    };
    const fetchMetadata = rs.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => ({
      ok: true,
      json: async () => ({
        protocolVersion: '2025-11-25',
        appProtocolVersion: '2026-01-26',
        extensionId: 'io.modelcontextprotocol/ui',
        resourceMimeType: 'text/html;profile=mcp-app',
      }),
    }));
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { fetch: fetchMetadata },
    });
    const signal = new AbortController().signal;

    try {
      const chatRequest = await MCP_APPS_CHAT_ADAPTER.createRequest({
        prompt: 'Weather in Hangzhou',
        conversation: { history: [], dataModel: {} },
        settings: {
          preset: 'gpt-5.5',
          apiKey: '',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-5.5',
        },
        host,
        signal,
      });
      expect(fetchMetadata).toHaveBeenCalledTimes(1);
      expect(fetchMetadata.mock.calls[0]?.[0]).toBe(
        'https://example.com/mcp-apps/metadata',
      );
      expect(fetchMetadata.mock.calls[0]?.[1]).toMatchObject({ signal });
      expect(chatRequest).toMatchObject({
        url: 'https://example.com/mcp-apps/stream',
        body: {
          registry: {
            protocolVersion: '2025-11-25',
            appProtocolVersion: '2026-01-26',
            capabilities: {
              extensions: {
                'io.modelcontextprotocol/ui': {
                  mimeTypes: ['text/html;profile=mcp-app'],
                },
              },
            },
            tools: [
              {
                name: WEATHER_API_NAME,
                _meta: { ui: { visibility: ['model'] } },
              },
              {
                name: PRODUCT_API_NAME,
                _meta: { ui: { visibility: ['model'] } },
              },
            ],
            resources: [
              {
                uri: WEATHER_RESOURCE_URI,
                mimeType: 'text/html;profile=mcp-app',
              },
              {
                uri: PRODUCT_RESOURCE_URI,
                mimeType: 'text/html;profile=mcp-app',
              },
            ],
          },
        },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 'weather-1',
        method: 'tools/call' as const,
        params: {
          name: WEATHER_API_NAME,
          arguments: { city: 'Hangzhou' },
        },
      };
      const reduced = MCP_APPS_CHAT_ADAPTER.stream.reduce(
        MCP_APPS_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: {
            protocolVersion: '2026-01-26',
            toolCall: request,
            resource: { uri: WEATHER_RESOURCE_URI },
          },
        },
      );
      const final = reduced.emissions.find((item) => item.type === 'final');
      expect(final).toBeDefined();
      if (!final || final.type !== 'final') return;
      expect(final.output).toMatchObject({
        kind: 'tool',
        tool: { name: WEATHER_API_NAME },
        resource: { uri: WEATHER_RESOURCE_URI },
        toolResult: {
          structuredContent: { weather: { city: 'Hangzhou' } },
        },
      });
      expect(
        MCP_APPS_CHAT_ADAPTER.preview.artifact(final.output).title,
      ).toBe('MCP Apps Exchange');
      const transcript = MCP_APPS_CHAT_ADAPTER.transcript.success(
        final.output,
      );
      expect(transcript).toContainEqual({
        kind: 'output',
        tone: 'info',
        text: 'LLM Tool Call',
        payload: {
          type: 'tool_call',
          name: WEATHER_API_NAME,
          arguments: { city: 'Hangzhou' },
        },
        payloadLayout: 'single',
      });
      expect(transcript).toContainEqual(expect.objectContaining({
        text: 'MCP Apps Tool Result',
      }));
      expect(transcript.map((message) => message.text)).toEqual([
        'LLM Tool Call',
        `Called ${WEATHER_API_NAME} and rendered ${WEATHER_RESOURCE_URI}.`,
        'MCP Apps Tool Result',
      ]);

      const hydrated = MCP_APPS_CHAT_ADAPTER.hydrate({
        history: [{
          role: 'assistant',
          content: JSON.stringify(final.output),
        }],
        previewMessages: [],
        previewPayloadUrls: null,
      });
      expect(hydrated.messages).toContainEqual(expect.objectContaining({
        text: 'LLM Tool Call',
        payload: {
          type: 'tool_call',
          name: WEATHER_API_NAME,
          arguments: { city: 'Hangzhou' },
        },
      }));
      expect(MCP_APPS_CHAT_ADAPTER.preview.source(final.output, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'dark',
        previewPayloadUrls: null,
      })).toMatchObject({
        kind: 'mcp-apps',
        mcpAppData: {
          renderer: 'weather',
          input: { city: 'Hangzhou' },
          result: { weather: { city: 'Hangzhou' } },
        },
        theme: 'dark',
      });

      const productRequest = {
        jsonrpc: '2.0' as const,
        id: 'product-1',
        method: 'tools/call' as const,
        params: {
          name: PRODUCT_API_NAME,
          arguments: { productId: 'sneaker' },
        },
      };
      const productStep = MCP_APPS_CHAT_ADAPTER.stream.reduce(
        MCP_APPS_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: {
            protocolVersion: '2026-01-26',
            toolCall: productRequest,
            resource: { uri: PRODUCT_RESOURCE_URI },
          },
        },
      );
      const productFinal = productStep.emissions.find((item) =>
        item.type === 'final'
      );
      expect(productFinal).toBeDefined();
      if (!productFinal || productFinal.type !== 'final') return;
      expect(productFinal.output).toMatchObject({
        kind: 'tool',
        tool: { name: PRODUCT_API_NAME },
        resource: { uri: PRODUCT_RESOURCE_URI },
        toolResult: {
          structuredContent: {
            product: { id: 'sneaker', category: 'SNEAKERS' },
          },
        },
      });
      expect(MCP_APPS_CHAT_ADAPTER.preview.source(productFinal.output, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'light',
        previewPayloadUrls: null,
      })).toMatchObject({
        kind: 'mcp-apps',
        mcpAppData: {
          renderer: 'product',
          input: { productId: 'sneaker' },
          result: { product: { id: 'sneaker' } },
        },
        theme: 'light',
      });
      if (productFinal.output.kind !== 'tool') return;
      expect(MCP_APPS_CHAT_ADAPTER.preview.source({
        ...productFinal.output,
        toolResult: {
          content: [{ type: 'text', text: 'Stale product result' }],
          structuredContent: {},
        },
      }, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'light',
        previewPayloadUrls: null,
      })).toMatchObject({
        kind: 'mcp-apps',
        mcpAppData: {
          renderer: 'product',
          result: { product: { id: 'sneaker' } },
        },
      });

      const messageStep = MCP_APPS_CHAT_ADAPTER.stream.reduce(
        MCP_APPS_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: {
            protocolVersion: '2026-01-26',
            message: '# Lynx\n\nLynx is a cross-platform UI framework.',
          },
        },
      );
      const messageFinal = messageStep.emissions.find((item) =>
        item.type === 'final'
      );
      expect(messageFinal).toBeDefined();
      if (!messageFinal || messageFinal.type !== 'final') return;
      expect(MCP_APPS_CHAT_ADAPTER.preview.source(messageFinal.output, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'light',
        previewPayloadUrls: null,
      })).toEqual({
        kind: 'mcp-apps',
        mcpAppData: {
          markdown: '# Lynx\n\nLynx is a cross-platform UI framework.',
        },
        theme: 'light',
      });
      expect('action' in MCP_APPS_CHAT_ADAPTER).toBe(false);
      expect(fetchMetadata).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
