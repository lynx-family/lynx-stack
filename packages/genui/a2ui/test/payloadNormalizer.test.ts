// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  createFallbackMessagesFromPlainText,
  createTextCardMessages,
  normalizePayloadToMessages,
  prepareMessagesForProcessing,
} from '../src/store/payloadNormalizer.js';
import type { ServerToClientMessage } from '../src/store/types.js';

describe('payloadNormalizer', () => {
  test('createFallbackMessagesFromPlainText wraps text in a Text component', () => {
    const msgs = createFallbackMessagesFromPlainText('hello');
    expect(msgs).toHaveLength(2);
    const update = msgs[1] as { updateComponents: { components: unknown[] } };
    expect(update.updateComponents.components[0]).toMatchObject({
      component: 'Text',
      text: 'hello',
    });
  });

  test('createTextCardMessages wraps text in a Card with Text child', () => {
    const msgs = createTextCardMessages('greetings');
    expect(msgs).toHaveLength(2);
    const update = msgs[1] as { updateComponents: { components: unknown[] } };
    expect(update.updateComponents.components).toHaveLength(2);
    const [card, text] = update.updateComponents
      .components as Record<string, unknown>[];
    expect(card['component']).toBe('Card');
    expect(text['component']).toBe('Text');
    expect(text['text']).toBe('greetings');
  });

  test('normalizePayloadToMessages passes through structured messages', () => {
    const input = [{ createSurface: { surfaceId: 's' } }];
    expect(normalizePayloadToMessages(input)).toEqual(input);
  });

  test('normalizePayloadToMessages wraps plain text in fallback', () => {
    const out = normalizePayloadToMessages('hi');
    expect(out).toHaveLength(2);
    expect((out[0] as { createSurface: unknown }).createSurface).toBeDefined();
  });

  test('normalizePayloadToMessages handles { kind: "text", data: "..." }', () => {
    const out = normalizePayloadToMessages({ kind: 'text', data: 'yo' });
    expect(out).toHaveLength(2);
    const update = out[1] as { updateComponents: { components: unknown[] } };
    expect(update.updateComponents.components).toHaveLength(2);
  });

  test('prepareMessagesForProcessing tags messageId and dedupes createSurface', () => {
    const messages = [
      { createSurface: { surfaceId: 's1' } },
      { createSurface: { surfaceId: 's1' } },
      {
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text' }],
        },
      },
    ] as ServerToClientMessage[];
    const active = new Set<string>();
    const result = prepareMessagesForProcessing(messages, 'task_1', active);
    expect(result.messages).toHaveLength(2);
    expect(result.hasComponentUpdate).toBe(true);
    for (const m of result.messages) {
      expect(m.messageId).toBe('task_1');
    }
    expect(active.has('s1')).toBe(true);
  });
});
