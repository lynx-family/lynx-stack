// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  isSharedConversationDoc,
  resolveSharedConversationProtocol,
  serializeConversation,
} from './sharedConversation.js';

describe('shared conversation protocol metadata', () => {
  test('preserves the original Lynx XML fragment in shared history', () => {
    const xmlFragment = '\n<text>杭州 &amp; 天气</text>\n';
    const modelOutput = '\n<!doctype lynx>original model output\n';
    const doc = serializeConversation({
      meta: {
        id: 'xml',
        title: 'Weather',
        protocol: 'lynx-xml',
        createdAt: 1,
        updatedAt: 1,
        messageCount: 1,
        previewText: '',
      },
      messages: [{
        conversationId: 'xml',
        seq: 0,
        role: 'assistant',
        content: '<!doctype lynx>final</lynx>',
        lynxXmlFragment: xmlFragment,
        lynxXmlModelOutput: modelOutput,
        createdAt: 1,
      }],
      snapshot: null,
    }, 'lynx-xml');
    expect(doc.messages[0]?.lynxXmlFragment).toBe(xmlFragment);
    expect(doc.messages[0]?.lynxXmlModelOutput).toBe(modelOutput);
    expect(
      isSharedConversationDoc({
        ...doc,
        messages: [{ ...doc.messages[0], lynxXmlModelOutput: 42 }],
      }),
    ).toBe(false);
    expect(isSharedConversationDoc(doc)).toBe(true);
    expect(
      isSharedConversationDoc({
        ...doc,
        messages: [{ ...doc.messages[0], lynxXmlFragment: 42 }],
      }),
    ).toBe(false);
  });

  test('treats legacy shared conversations without protocol as A2UI', () => {
    expect(resolveSharedConversationProtocol({})).toBe('a2ui');
  });

  test('keeps OpenUI shared conversations explicit', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'openui' })).toBe(
      'openui',
    );
  });

  test('keeps MCP Apps shared conversations explicit', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'mcp-apps' })).toBe(
      'mcp-apps',
    );
  });

  test('keeps Lynx XML shared conversations explicit', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'lynx-xml' })).toBe(
      'lynx-xml',
    );
  });

  test('keeps HTML shared conversations explicit', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'html' })).toBe(
      'html',
    );
  });

  test('rejects unknown shared conversation protocols', () => {
    expect(resolveSharedConversationProtocol({ protocol: 'unknown' })).toBe(
      null,
    );
  });
});
