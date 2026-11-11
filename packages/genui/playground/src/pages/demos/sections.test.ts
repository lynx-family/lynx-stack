// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { A2UI_DEMOS_PAGE_SOURCE } from './a2ui.js';
import { LYNX_XML_DEMOS_PAGE_SOURCE } from './lynx-xml.js';
import { MCP_APPS_DEMOS_PAGE_SOURCE } from './mcp-apps.js';
import { OPENUI_DEMOS_PAGE_SOURCE } from './openui.js';

test.each([
  { name: 'OpenUI', source: OPENUI_DEMOS_PAGE_SOURCE },
  { name: 'A2UI', source: A2UI_DEMOS_PAGE_SOURCE },
  { name: 'Lynx XML', source: LYNX_XML_DEMOS_PAGE_SOURCE },
  { name: 'MCP Apps', source: MCP_APPS_DEMOS_PAGE_SOURCE },
])('$name sidebar groups include every scenario exactly once', ({ source }) => {
  const ids = source.sections.flatMap(section =>
    section.scenarios.map(scenario => scenario.id)
  );
  expect([...ids].sort()).toEqual(
    source.scenarios.map(item => item.id).sort(),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

test('keeps all Canvas examples together in the final Web-only group', () => {
  const sections = OPENUI_DEMOS_PAGE_SOURCE.sections;
  expect(sections.map(section => section.id)).toEqual([
    'chat',
    'examples',
    'canvas',
  ]);
  const canvas = sections[sections.length - 1]!;
  expect(canvas.title).toContain('Web only');
  expect(canvas.scenarios.map(scenario => scenario.id)).toContain(
    'canvas-sine-wave',
  );
  expect(canvas.scenarios.every(scenario => scenario.id.startsWith('canvas-')))
    .toBe(true);
});
