// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import app from '../src/app.js';

interface MockActionService {
  generateValidated(
    messages: unknown,
    options: unknown,
    conversation: unknown,
    validationOptions: unknown,
    abortSignal?: AbortSignal,
  ): Promise<unknown>;
}

type GlobalWithActionService = typeof globalThis & {
  __A2UI_AGENT_SERVICE__?: MockActionService;
};

describe('A2UI action route', () => {
  test('accepts the complete v1 action envelope', async () => {
    const global = globalThis as GlobalWithActionService;
    const previousService = global.__A2UI_AGENT_SERVICE__;
    let receivedMessages: unknown;
    let receivedValidationOptions: unknown;
    global.__A2UI_AGENT_SERVICE__ = {
      generateValidated(
        messages,
        _options,
        _conversation,
        validationOptions,
      ) {
        receivedMessages = messages;
        receivedValidationOptions = validationOptions;
        return Promise.resolve({
          ok: true,
          text: '',
          messages: [],
          errors: [],
          warnings: [],
          attempts: 1,
        });
      },
    };

    try {
      const dataModel = {
        selectedItem: { id: 'item-7' },
        total: 3,
      };
      const response = await app.request('/a2ui/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.46',
        },
        body: JSON.stringify({
          version: 'v1.0',
          action: {
            context: { itemId: 'item-7' },
            metadata: { extensions: { com_lynx_trace_id: 'trace-1' } },
            name: 'refresh',
            sourceComponentId: 'refresh_button',
            surfaceId: 'surface-1',
            timestamp: '2026-08-19T01:02:03.456Z',
            userMessage: 'Refresh item 7',
          },
          conversation: { history: [], dataModel },
        }),
      });

      expect(response.status).toBe(200);
      expect(receivedMessages).toEqual([{
        content: 'A2UI_USER_ACTION: '
          + JSON.stringify({
            version: 'v1.0',
            action: {
              name: 'refresh',
              surfaceId: 'surface-1',
              sourceComponentId: 'refresh_button',
              timestamp: '2026-08-19T01:02:03.456Z',
              context: { itemId: 'item-7' },
              userMessage: 'Refresh item 7',
              metadata: {
                extensions: { com_lynx_trace_id: 'trace-1' },
              },
            },
          }),
        role: 'user',
      }]);
      expect(receivedValidationOptions).toEqual({
        requireCreateSurface: false,
        existingSurfaceIds: ['surface-1'],
        existingDataModelBySurface: {
          'surface-1': dataModel,
        },
      });
    } finally {
      global.__A2UI_AGENT_SERVICE__ = previousService;
    }
  });

  test('normalizes the legacy surfaceId plus action request', async () => {
    const global = globalThis as GlobalWithActionService;
    const previousService = global.__A2UI_AGENT_SERVICE__;
    let receivedMessages: unknown;
    global.__A2UI_AGENT_SERVICE__ = {
      generateValidated(messages) {
        receivedMessages = messages;
        return Promise.resolve({
          attempts: 1,
          errors: [],
          messages: [],
          ok: true,
          text: '',
          warnings: [],
        });
      },
    };

    try {
      const response = await app.request('/a2ui/action', {
        body: JSON.stringify({
          action: { context: { itemId: 'item-7' }, name: 'refresh' },
          surfaceId: 'surface-legacy',
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.47',
        },
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const content = (receivedMessages as [{ content: string }])[0].content;
      const payload = JSON.parse(
        content.slice('A2UI_USER_ACTION: '.length),
      ) as { action: Record<string, unknown>; version: string };
      expect(payload).toMatchObject({
        action: {
          context: { itemId: 'item-7' },
          name: 'refresh',
          sourceComponentId: 'legacy',
          surfaceId: 'surface-legacy',
        },
        version: 'v1.0',
      });
      expect(typeof payload.action.timestamp).toBe('string');
    } finally {
      global.__A2UI_AGENT_SERVICE__ = previousService;
    }
  });

  test('rejects wrong versions, missing fields, and invalid timestamps', async () => {
    const cases = [
      {
        version: 'v0.9',
        action: { name: 'refresh' },
      },
      {
        version: 'v1.0',
        action: {
          context: {},
          name: 'refresh',
          surfaceId: 'surface-1',
          timestamp: '2026-08-19T01:02:03Z',
        },
      },
      {
        version: 'v1.0',
        action: {
          context: {},
          name: 'refresh',
          sourceComponentId: 'refresh_button',
          surfaceId: 'surface-1',
          timestamp: 'not-a-date',
        },
      },
      {
        version: 'v1.0',
        action: {
          context: {},
          name: 'refresh',
          sourceComponentId: 'refresh_button',
          surfaceId: 'surface-1',
          timestamp: '2026-08-19T01:02:03Z',
          unexpected: true,
        },
      },
      {
        version: 'v1.0',
        action: {
          context: {},
          metadata: { extensions: {}, unexpected: true },
          name: 'refresh',
          sourceComponentId: 'refresh_button',
          surfaceId: 'surface-1',
          timestamp: '2026-08-19T01:02:03Z',
        },
      },
      {
        version: 'v1.0',
        action: {
          context: {},
          metadata: { extensions: { 'not-valid': true } },
          name: 'refresh',
          sourceComponentId: 'refresh_button',
          surfaceId: 'surface-1',
          timestamp: '2026-08-19T01:02:03Z',
        },
      },
    ];

    for (const [index, body] of cases.entries()) {
      const response = await app.request('/a2ui/action', {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `203.0.113.${50 + index}`,
        },
        method: 'POST',
      });
      expect(response.status).toBe(400);
    }
  });

  test('rejects an explicit wrong version on the stream route', async () => {
    const response = await app.request('/a2ui/action/stream', {
      body: JSON.stringify({
        action: { name: 'refresh' },
        version: 'v0.9',
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.54',
      },
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });
});
