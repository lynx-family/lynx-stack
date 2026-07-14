// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { A2UI_CHAT_ADAPTER } from './a2ui.js';
import { OPENUI_CHAT_ADAPTER } from './openui.js';
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
        usage: {
          promptTokens: 2,
          completionTokens: 3,
          totalTokens: 5,
          cachedTokens: 0,
        },
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
        usage: {
          promptTokens: 4,
          completionTokens: 6,
          totalTokens: 10,
          cachedTokens: 0,
        },
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
});
