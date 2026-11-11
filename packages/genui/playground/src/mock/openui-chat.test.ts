// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync } from 'node:fs';

import { describe, expect, test } from '@rstest/core';

import { resolveOpenUIExampleAssets } from './openui-chat-assets.js';
import { OPENUI_CHAT_CASES } from './openui-chat-scenarios.js';
import { parseOpenUIScenario } from './openui-scenarios.js';
import {
  OPENUI_DEMOS_LIST_SOURCE,
  OPENUI_DEMOS_PAGE_SOURCE,
} from '../pages/demos/openui.js';
import { PROTOCOLS } from '../utils/protocol.js';
import { canInlineOpenUIRenderUrl } from '../utils/renderUrl.js';

const baseUrl = 'https://lynx-stack.dev/genui/';

function componentsIn(value: unknown, names = new Set<string>()): Set<string> {
  if (value && typeof value === 'object') {
    if (
      'type' in value && value.type === 'element' && 'typeName' in value
      && typeof value.typeName === 'string'
    ) names.add(value.typeName);
    for (const child of Object.values(value)) componentsIn(child, names);
  }
  return names;
}

describe('OpenUI Chat reference cases', () => {
  test('covers all 26 component contracts with complete parsed examples', () => {
    const used = new Set<string>();
    expect(OPENUI_CHAT_CASES).toHaveLength(18);
    for (const scenario of OPENUI_CHAT_CASES) {
      const parsed = parseOpenUIScenario(scenario.raw, 'chat');
      expect(parsed.root?.typeName).toBe('Card');
      expect(parsed.meta.errors, scenario.id).toEqual([]);
      expect(parsed.meta.unresolved, scenario.id).toEqual([]);
      expect(parsed.meta.incomplete, scenario.id).toBe(false);
      componentsIn(parsed.root, used);
    }
    expect([...used].sort()).toEqual([
      'BoldText',
      'Button',
      'Buttons',
      'Card',
      'CheckBoxGroup',
      'CheckBoxItem',
      'Col',
      'CompositeCardBlock',
      'CompositeCardItem',
      'Form',
      'FormControl',
      'ImageText',
      'Input',
      'ListBlock',
      'ListItem',
      'ProductFeature',
      'RadioGroup',
      'RadioItem',
      'SectionBlock',
      'SectionItem',
      'Slider',
      'Steps',
      'StepsItem',
      'Table',
      'Text',
      'TextContent',
    ].sort());
  });

  test.each(OPENUI_CHAT_CASES)(
    '$id uses a short source link with the Chat library',
    scenario => {
      const url = OPENUI_DEMOS_LIST_SOURCE.createPreviewUrl({
        baseUrl,
        protocol: PROTOCOLS.openui,
        scenario: { ...scenario, parsed: '' },
        theme: 'light',
      });
      const params = new URL(url).searchParams;
      expect(params.get('openuiLibrary')).toBe('chat');
      expect(params.get('rawTextUrl')).toBe(
        new URL(scenario.sourcePath, baseUrl).href,
      );
      expect(params.has('rawText')).toBe(false);
      expect(canInlineOpenUIRenderUrl(url)).toBe(true);
      expect(
        readFileSync(
          new URL(
            `./${scenario.sourcePath.replace('demos/', '')}`,
            import.meta.url,
          ),
          'utf8',
        ),
      ).toBe(scenario.raw);
    },
  );

  test('keeps Chat selection through editing, playback and the parsed JSON view', () => {
    const scenario = OPENUI_DEMOS_PAGE_SOURCE.findScenario('chat-six-day-trip');
    expect(scenario).toBeDefined();
    const editorValue = 'root = Card([Text("number", "42")])';
    const commit = OPENUI_DEMOS_PAGE_SOURCE.commit({
      editorValue,
      editorEdited: true,
      scenario,
    });
    if ('error' in commit) throw new Error(commit.error);
    expect(commit.value.playbackChunks.join('')).toBe(editorValue);
    expect(
      OPENUI_DEMOS_PAGE_SOURCE.createPreviewSource({
        input: commit.value.previewInput,
        isPlaybackActive: true,
        protocol: PROTOCOLS.openui,
        theme: 'dark',
      }),
    ).toMatchObject({
      kind: 'openui',
      openuiLibrary: 'chat',
      rawText: editorValue,
      playbackMode: true,
      theme: 'dark',
    });
    const json = OPENUI_DEMOS_PAGE_SOURCE.editor.views.find(view =>
      view.id === 'parsed'
    )?.getValue({ editorValue, scenario });
    const parsed = JSON.parse(json ?? '{}') as {
      meta?: { errors?: unknown[] };
    };
    expect(parsed.meta?.errors).toEqual([]);
    expect(parseOpenUIScenario(editorValue).meta.errors.length).toBeGreaterThan(
      0,
    );
  });

  test('uses the copied source only while an example remains unedited', () => {
    const scenario = OPENUI_DEMOS_PAGE_SOURCE.findScenario('chat-six-day-trip');
    if (!scenario) throw new Error('Missing trip example');
    const unchanged = OPENUI_DEMOS_PAGE_SOURCE.commit({
      editorValue: scenario.raw,
      editorEdited: false,
      scenario,
    });
    const edited = OPENUI_DEMOS_PAGE_SOURCE.commit({
      editorValue: scenario.raw + '\n',
      editorEdited: true,
      scenario,
    });
    expect(unchanged).toMatchObject({
      value: {
        previewInput: {
          rawTextUrl: scenario.sourcePath,
          openuiLibrary: 'chat',
        },
      },
    });
    if ('error' in edited) throw new Error(edited.error);
    expect(edited.value.previewInput.rawTextUrl).toBeUndefined();
  });

  test('resolves local images and sources on subpath deployments without rewriting other URLs', () => {
    const raw =
      'ImageText("./demos/openui/chat/assets/place.png", "test", "Place")\nTextContent("https://example.com/image.png")\nButton("Source", {url:"./demos/openui/chat/references.html#city"})';
    const resolved = resolveOpenUIExampleAssets(
      raw,
      `${baseUrl}render.html?rawTextUrl=source`,
    );
    expect(resolved).toContain(
      'https://lynx-stack.dev/genui/demos/openui/chat/assets/place.png',
    );
    expect(resolved).toContain(
      'https://lynx-stack.dev/genui/demos/openui/chat/references.html#city',
    );
    expect(resolved).toContain('https://example.com/image.png');
  });
});
