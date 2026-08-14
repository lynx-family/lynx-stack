// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  isTrustedPreviewMessage,
  resolveDemoMessagesUrl,
  resolveTrustedPreviewBundleUrl,
} from './previewSecurity.js';

describe('preview security', () => {
  const pageUrl = 'https://playground.example.com/genui/render.html';

  test('allows same-origin web preview bundles', () => {
    expect(resolveTrustedPreviewBundleUrl('./a2ui.web.js', pageUrl)).toBe(
      'https://playground.example.com/genui/a2ui.web.js',
    );
  });

  test('rejects executable cross-origin or non-HTTP(S) bundle URLs', () => {
    expect(
      resolveTrustedPreviewBundleUrl(
        'https://attacker.example/payload.web.js',
        pageUrl,
      ),
    ).toBe(null);
    expect(resolveTrustedPreviewBundleUrl('javascript:alert(1)', pageUrl))
      .toBe(null);
    expect(
      resolveTrustedPreviewBundleUrl(
        'https://user:password@playground.example.com/genui/a2ui.web.js',
        pageUrl,
      ),
    ).toBe(null);
  });

  test('rejects bundle query and fragment delimiters before parsing', () => {
    expect(resolveTrustedPreviewBundleUrl('./a2ui.web.js?', pageUrl)).toBe(
      null,
    );
    expect(resolveTrustedPreviewBundleUrl('./a2ui.web.js#', pageUrl)).toBe(
      null,
    );
  });

  test('builds demo payload URLs only from safe identifiers', () => {
    expect(resolveDemoMessagesUrl('citywalk-list', pageUrl)).toBe(
      'https://playground.example.com/genui/demos/citywalk-list.json',
    );
    expect(resolveDemoMessagesUrl('../models', pageUrl)).toBe(null);
    expect(resolveDemoMessagesUrl('demo?admin=1', pageUrl)).toBe(null);
    expect(resolveDemoMessagesUrl('demo#payload', pageUrl)).toBe(null);
  });

  test('requires the expected origin and optional source window', () => {
    const parent = {};
    const event = {
      origin: 'https://playground.example.com',
      source: parent,
    };
    expect(
      isTrustedPreviewMessage(
        event,
        'https://playground.example.com',
        parent,
      ),
    ).toBe(true);
    expect(
      isTrustedPreviewMessage(
        { ...event, origin: 'https://attacker.example' },
        'https://playground.example.com',
        parent,
      ),
    ).toBe(false);
    expect(
      isTrustedPreviewMessage(
        { ...event, source: {} },
        'https://playground.example.com',
        parent,
      ),
    ).toBe(false);
  });
});
