// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  OPENUI_INLINE_RENDER_URL_MAX_LENGTH,
  buildOpenUIRenderUrl,
  canInlineOpenUIRenderUrl,
} from './renderUrl.js';

describe('OpenUI render URLs', () => {
  test('marks oversized inline rawText URLs as unsafe', () => {
    const rawText = 'root = Stack([])\n'.repeat(600);
    const url = buildOpenUIRenderUrl({
      rawText,
    }, 'https://lynx-stack.dev/genui/');

    expect(url.length).toBeGreaterThan(OPENUI_INLINE_RENDER_URL_MAX_LENGTH);
    expect(canInlineOpenUIRenderUrl(url)).toBe(false);
  });

  test('keeps rawTextUrl render URLs short', () => {
    const url = buildOpenUIRenderUrl({
      rawTextUrl:
        'https://example.supabase.co/storage/v1/object/public/genui/openui/id/raw.txt',
    }, 'https://lynx-stack.dev/genui/');

    expect(canInlineOpenUIRenderUrl(url)).toBe(true);
    expect(url).toContain('rawTextUrl=');
    expect(url).not.toContain('rawText=');
  });

  test('forwards the selected theme to the OpenUI runtime', () => {
    const url = buildOpenUIRenderUrl({
      rawText: 'root = Stack([])',
      theme: 'dark',
      instant: true,
      liveAction: true,
    }, 'https://lynx-stack.dev/genui/');

    expect(new URL(url).searchParams.get('theme')).toBe('dark');
    expect(new URL(url).searchParams.get('instant')).toBe('1');
    expect(new URL(url).searchParams.get('liveAction')).toBe('1');
  });
});
