// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { resolveTrustedConversationImportUrl } from './shareConversation.js';

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
