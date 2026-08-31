// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  isPreviewArtifactMessage,
  isPreviewReadyMessage,
} from '../src/playground/browser/preview-channel.js';

const capability = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  revision: '7',
  hash: 'a'.repeat(64),
  nonce: '22222222-2222-4222-8222-222222222222',
};

describe('preview one-shot channel', () => {
  test('binds readiness to source, origin, conversation, revision, hash, and nonce', () => {
    const source = {};
    const event = {
      origin: 'http://localhost:61432',
      source,
      data: { type: 'genui-preview-ready', ...capability },
    };
    expect(
      isPreviewReadyMessage(
        event,
        'http://localhost:61432',
        source,
        capability,
      ),
    ).toBe(true);
    expect(
      isPreviewReadyMessage(
        { ...event, source: {} },
        event.origin,
        source,
        capability,
      ),
    ).toBe(false);
    expect(
      isPreviewReadyMessage(
        { ...event, data: { ...event.data, revision: '8' } },
        event.origin,
        source,
        capability,
      ),
    ).toBe(false);
  });

  test('rejects stale or cross-origin artifact delivery', () => {
    const parent = {};
    const event = {
      origin: 'http://127.0.0.1:58321',
      source: parent,
      data: { type: 'genui-preview-artifact', ...capability, source: '<lynx>' },
    };
    expect(
      isPreviewArtifactMessage(event, event.origin, parent, capability),
    ).toBe(true);
    expect(
      isPreviewArtifactMessage(
        { ...event, origin: 'null' },
        event.origin,
        parent,
        capability,
      ),
    ).toBe(false);
    expect(
      isPreviewArtifactMessage(
        {
          ...event,
          data: {
            ...event.data,
            nonce: '33333333-3333-4333-8333-333333333333',
          },
        },
        event.origin,
        parent,
        capability,
      ),
    ).toBe(false);
  });
});
