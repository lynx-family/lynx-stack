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

  test('allows GenUI Supabase Storage conversation documents', () => {
    expect(
      resolveTrustedConversationImportUrl(
        'https://project.supabase.co/storage/v1/object/public/genui/a2ui/abc/messages.json',
        pageOrigin,
      ),
    ).toBe(
      'https://project.supabase.co/storage/v1/object/public/genui/a2ui/abc/messages.json',
    );
  });

  test('rejects arbitrary cross-origin import URLs', () => {
    expect(
      resolveTrustedConversationImportUrl(
        'https://example.com/messages.json',
        pageOrigin,
      ),
    ).toBe(null);
    expect(
      resolveTrustedConversationImportUrl(
        'http://127.0.0.1:8000/secrets.json',
        pageOrigin,
      ),
    ).toBe(null);
  });

  test('rejects unrelated Supabase Storage paths', () => {
    expect(
      resolveTrustedConversationImportUrl(
        'https://project.supabase.co/storage/v1/object/public/other/a2ui/abc/messages.json',
        pageOrigin,
      ),
    ).toBe(null);
  });
});
