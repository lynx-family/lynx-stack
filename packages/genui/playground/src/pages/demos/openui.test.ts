// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createParser } from '@openuidev/lang-core';
import { describe, expect, test } from '@rstest/core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui/openui/prompt';

import {
  OPENUI_DEMOS_LIST_SOURCE,
  OPENUI_DEMOS_PAGE_SOURCE,
} from './openui.js';
import { splitOpenUiResponse } from '../../../lynx-src/openui/inlineResponse.js';
import { OPENUI_SCENARIOS as NATIVE_OPENUI_SCENARIOS } from '../../../lynx-src/openui/mockData.js';
import { PROTOCOLS } from '../../utils/protocol.js';

const library = createOpenUiPromptLibrary();
const parser = createParser(library.toJSONSchema(), library.root);

describe('OpenUI demo previews', () => {
  test.each(NATIVE_OPENUI_SCENARIOS)(
    '$id native fallback matches the validated web example',
    ({ id, raw }) => {
      expect(raw).toBe(
        OPENUI_DEMOS_LIST_SOURCE.scenarios.find((scenario) =>
          scenario.id === id
        )
          ?.raw,
      );
    },
  );

  test.each(OPENUI_DEMOS_LIST_SOURCE.scenarios)(
    '$id satisfies the component schemas used by the renderer',
    ({ raw }) => {
      const blocks = splitOpenUiResponse(raw).filter(part =>
        part.kind === 'code'
      );
      for (
        const code of blocks.length > 0
          ? blocks.map(block => block.content)
          : [raw]
      ) {
        const parsed = parser.parse(code);
        expect(parsed.root).not.toBeNull();
        expect(parsed.meta.incomplete).toBe(false);
        expect(parsed.meta.unresolved).toEqual([]);
        expect(parsed.meta.errors).toEqual([]);
      }
    },
  );

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

  test('preserves inline mode when editing and sharing the mixed reply', () => {
    const scenario = OPENUI_DEMOS_PAGE_SOURCE.findScenario(
      'inline-winter-trip',
    );
    expect(scenario).toBeDefined();
    if (!scenario) return;

    expect(scenario.raw).toContain('```openui id=winter-trip');
    expect(scenario.raw).toContain('### Planning notes');
    const url = new URL(OPENUI_DEMOS_LIST_SOURCE.createPreviewUrl({
      baseUrl: 'https://lynx-stack.dev/genui/',
      protocol: PROTOCOLS.openui,
      scenario,
      theme: 'light',
    }));
    expect(url.searchParams.get('inlineMode')).toBe('1');

    const result = OPENUI_DEMOS_PAGE_SOURCE.commit({
      editorValue: scenario.raw.replace('Hokkaido · 8 days', 'Winter holiday'),
      editorEdited: true,
      scenario,
    });
    expect('value' in result).toBe(true);
    if (!('value' in result)) return;
    expect(result.value.previewInput.inlineMode).toBe(true);
    expect(result.value.playbackChunks.join('')).toBe(
      result.value.previewInput.rawText,
    );
    expect(
      OPENUI_DEMOS_PAGE_SOURCE.createPreviewSource({
        input: result.value.previewInput,
        isPlaybackActive: true,
        protocol: PROTOCOLS.openui,
        theme: 'dark',
      }).inlineMode,
    ).toBe(true);
  });
});
