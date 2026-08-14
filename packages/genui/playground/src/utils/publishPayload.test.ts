// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rs, test } from '@rstest/core';

import { publishA2UIPayload, publishOpenUIPayload } from './publishPayload.js';

describe('payload publishing', () => {
  test('uploads through GenUI Server PUT endpoints and uses returned URLs', async () => {
    const fetchPayload = rs.fn(async () => ({
      ok: true,
      json: async () => ({
        preview: {
          messagesUrl: 'https://storage.example.com/messages.json',
          actionMocksUrl: 'https://storage.example.com/action-mocks.json',
          rawTextUrl: 'https://storage.example.com/raw.txt',
        },
      }),
    }));
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        fetch: fetchPayload,
        location: {
          hostname: 'lynx-stack.dev',
          protocol: 'https:',
        },
      },
    });

    try {
      await expect(publishA2UIPayload(['message'], { tap: 'action' }))
        .resolves.toEqual({
          messagesUrl: 'https://storage.example.com/messages.json',
          actionMocksUrl: 'https://storage.example.com/action-mocks.json',
        });
      await expect(publishOpenUIPayload('root = Text("Hello")'))
        .resolves.toEqual({
          rawTextUrl: 'https://storage.example.com/raw.txt',
        });

      expect(fetchPayload.mock.calls[0]?.[0]).toBe(
        'https://genui-server.vercel.app/a2ui/payload',
      );
      expect(fetchPayload.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' });
      expect(JSON.parse(String(fetchPayload.mock.calls[0]?.[1]?.body))).toEqual(
        {
          messages: ['message'],
          actionMocks: { tap: 'action' },
        },
      );
      expect(fetchPayload.mock.calls[1]?.[0]).toBe(
        'https://genui-server.vercel.app/openui/payload',
      );
      expect(fetchPayload.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
      expect(JSON.parse(String(fetchPayload.mock.calls[1]?.[1]?.body))).toEqual(
        {
          rawText: 'root = Text("Hello")',
        },
      );
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
