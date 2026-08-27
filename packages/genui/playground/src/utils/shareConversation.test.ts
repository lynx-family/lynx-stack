// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rs, test } from '@rstest/core';

import {
  publishConversation,
  resolveTrustedConversationImportUrl,
} from './shareConversation.js';
import { SHARED_CONVERSATION_KIND } from '../storage/sharedConversation.js';
import type { SharedConversationDoc } from '../storage/sharedConversation.js';

function conversationDoc(protocol?: string): SharedConversationDoc {
  return {
    v: 1,
    kind: SHARED_CONVERSATION_KIND,
    ...(protocol === undefined ? undefined : { protocol }),
    title: 'Shared conversation',
    createdAt: 1,
    updatedAt: 2,
    messages: [],
    snapshot: null,
  };
}

describe('publishConversation', () => {
  test('stores conversations under their validated protocol method', async () => {
    const fetchPayload = rs.fn(async () => ({
      ok: true,
      json: async () => ({
        preview: { messagesUrl: 'https://storage.example.com/messages.json' },
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
      for (
        const protocol of [
          undefined,
          'a2ui',
          'openui',
          'mcp-apps',
          'lynx-xml',
          'html',
        ]
      ) {
        await publishConversation(conversationDoc(protocol));
      }

      const locations = fetchPayload.mock.calls.map(([, init]) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return { method: body.method, type: body.type };
      });
      expect(locations).toEqual([
        { method: 'a2ui', type: 'conversation' },
        { method: 'a2ui', type: 'conversation' },
        { method: 'openui', type: 'conversation' },
        { method: 'mcp-apps', type: 'conversation' },
        { method: 'lynx-xml', type: 'conversation' },
        { method: 'html', type: 'conversation' },
      ]);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  test('rejects an unknown protocol before uploading', async () => {
    await expect(publishConversation(conversationDoc('unknown'))).rejects
      .toThrow('Unsupported conversation protocol');
  });
});

describe('resolveTrustedConversationImportUrl', () => {
  const pageOrigin = 'http://localhost:3001';

  test('allows same-origin shared conversation documents', () => {
    expect(
      resolveTrustedConversationImportUrl('/__a2ui/abc/messages', pageOrigin),
    ).toBe('http://localhost:3001/__a2ui/abc/messages');
  });

  test('treats the HTTPS URL returned by the GenUI server as opaque', () => {
    expect(
      resolveTrustedConversationImportUrl(
        'https://storage.example.com/custom/path/conversation.json',
        pageOrigin,
      ),
    ).toBe(
      'https://storage.example.com/custom/path/conversation.json',
    );
  });

  test('rejects insecure cross-origin import URLs', () => {
    expect(
      resolveTrustedConversationImportUrl(
        'http://storage.example.com/conversation.json',
        pageOrigin,
      ),
    ).toBe(null);
  });

  test('rejects URLs with embedded credentials or unsafe protocols', () => {
    expect(
      resolveTrustedConversationImportUrl(
        'https://user:password@storage.example.com/conversation.json',
        pageOrigin,
      ),
    ).toBe(null);
    expect(
      resolveTrustedConversationImportUrl(
        'http://user:password@localhost:3001/conversation.json',
        pageOrigin,
      ),
    ).toBe(null);
    expect(
      resolveTrustedConversationImportUrl(
        'javascript:alert(1)',
        pageOrigin,
      ),
    ).toBe(null);
  });
});
