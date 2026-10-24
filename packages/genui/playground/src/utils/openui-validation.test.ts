// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { parseOpenUIScenario } from '../mock/openui-scenarios.js';
import { OPENUI_COMPONENT_CATALOG_SOURCE } from '../pages/catalog/openui.js';
import { OPENUI_CHAT_ADAPTER } from '../pages/chat/openui.js';
import { OPENUI_DEMOS_PAGE_SOURCE } from '../pages/demos/openui.js';

const INVALID_WRAP = 'root = Stack([], "column", "not-a-boolean")';

describe('OpenUI editor validation', () => {
  test.each([
    { raw: INVALID_WRAP, path: '/wrap' },
    { raw: 'root = Stack([], "diagonal")', path: '/direction' },
    { raw: 'root = CardHeader(12)', path: '/title' },
  ])('reports the renderer schema violation at $path', ({ raw, path }) => {
    const result = parseOpenUIScenario(raw);

    expect(result.meta.errors).toEqual([
      expect.objectContaining({ code: 'type-mismatch', path }),
    ]);
  });

  test('reports invalid nested fields and preserves valid sibling tabs', () => {
    const result = parseOpenUIScenario(
      'root = Tabs([{ value: 12, title: "Invalid", child: Text("Bad") }, { value: "valid", title: "Valid", child: Text("Kept") }])',
    );

    expect(result.meta.errors).toEqual([
      expect.objectContaining({ code: 'type-mismatch', path: '/tabs/0/value' }),
    ]);
    expect(result.root?.props.tabs).toMatchObject([{ value: 'valid' }]);
  });

  test('keeps incomplete enum values parseable during streaming', () => {
    const result = parseOpenUIScenario('root = Stack([], "col');

    expect(result.meta.incomplete).toBe(true);
    expect(result.meta.errors).toEqual([]);
  });

  test('blocks invalid catalog edits before opening the preview', () => {
    const preview = OPENUI_COMPONENT_CATALOG_SOURCE.usage.buildPreview({
      baseUrl: 'https://lynx-stack.dev/genui/',
      theme: 'light',
      value: INVALID_WRAP,
    });

    expect(preview.url).toBe('');
    expect(preview.error).toContain('/wrap');
  });

  test('reparses unchanged demo source instead of displaying a cached tree', () => {
    const raw = 'root = Stack([], "column", false)';
    const view = OPENUI_DEMOS_PAGE_SOURCE.editor.views.find(
      ({ id }) => id === 'parsed',
    )!;
    const result = JSON.parse(view.getValue({
      editorValue: raw,
      scenario: { id: 'test', title: 'Test', raw, parsed: '{"stale":true}' },
    })) as ReturnType<typeof parseOpenUIScenario>;

    expect(result).toEqual(parseOpenUIScenario(raw));
    expect(result.root?.props.wrap).toBe(false);
  });

  test('includes the same structured errors in the Chat JSON output', () => {
    const artifact = OPENUI_CHAT_ADAPTER.preview.artifact({
      rawText: INVALID_WRAP,
      scenarioTitle: 'Generated response',
    });
    const json = artifact.views.find(({ id }) => id === 'json')!;
    const result = JSON.parse(json.text) as ReturnType<
      typeof parseOpenUIScenario
    >;

    expect(result).toEqual(parseOpenUIScenario(INVALID_WRAP));
    expect(result.root?.props).not.toHaveProperty('wrap');
  });
});
