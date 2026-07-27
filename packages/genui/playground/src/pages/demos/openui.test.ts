// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  OPENUI_DEMOS_LIST_SOURCE,
  OPENUI_DEMOS_PAGE_SOURCE,
} from './openui.js';
import { PROTOCOLS } from '../../utils/protocol.js';

describe('OpenUI demo previews', () => {
  test('keeps the editorial Release Review scenario parseable', () => {
    const scenario = OPENUI_DEMOS_LIST_SOURCE.scenarios.find(
      ({ id }) => id === 'new-interactive-controls',
    );
    expect(scenario?.title).toBe('Release Review');

    const parsed = JSON.parse(scenario?.parsed ?? '{}') as {
      root?: { typeName?: string };
      meta?: {
        incomplete?: boolean;
        unresolved?: unknown[];
        errors?: unknown[];
      };
    };
    expect(parsed.root?.typeName).toBe('Column');
    expect(parsed.meta?.incomplete).toBe(false);
    expect(parsed.meta?.unresolved).toEqual([]);
    expect(parsed.meta?.errors).toEqual([]);
  });

  test('keeps the list preview theme and reset key in sync', () => {
    const scenario = OPENUI_DEMOS_LIST_SOURCE.scenarios[0];
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const url = new URL(OPENUI_DEMOS_LIST_SOURCE.createPreviewUrl({
      baseUrl: 'https://lynx-stack.dev/genui/',
      protocol: PROTOCOLS.openui,
      scenario,
      theme: 'dark',
    }));

    expect(url.searchParams.get('theme')).toBe('dark');
    expect(OPENUI_DEMOS_LIST_SOURCE.createResetKey({
      protocol: PROTOCOLS.openui,
      theme: 'dark',
    })).toBe('openui|dark');
  });

  test('keeps the detail preview theme in sync', () => {
    expect(OPENUI_DEMOS_PAGE_SOURCE.createPreviewSource({
      input: { rawText: 'root = Stack([])' },
      isPlaybackActive: true,
      protocol: PROTOCOLS.openui,
      theme: 'light',
    })).toEqual({
      kind: 'openui',
      rawText: 'root = Stack([])',
      theme: 'light',
      playbackMode: true,
    });
  });
});
