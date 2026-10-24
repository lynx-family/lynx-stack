// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import { splitOpenUiResponse } from '../../lynx-src/openui/inlineResponse.js';
import { OPENUI_INLINE_TRIP_RAW } from '../../lynx-src/openui/mockData.js';
import {
  parseOpenUIScenario,
  parseOpenUIScenarioRaw,
} from '../mock/openui-scenarios.js';

test('keeps Markdown and three self-contained UI programs in source order', () => {
  const parts = splitOpenUiResponse(OPENUI_INLINE_TRIP_RAW);
  expect(parts.map(part => part.kind)).toEqual([
    'text',
    'code',
    'text',
    'code',
    'text',
    'code',
    'text',
  ]);
  for (const block of parts.filter(part => part.kind === 'code')) {
    expect(block.complete).toBe(true);
    const parsed = parseOpenUIScenario(block.content);
    expect(parsed.root?.typeName).toBe('Card');
    expect(parsed.meta.unresolved).toEqual([]);
    expect(parsed.meta.orphaned).toEqual([]);
    expect(parsed.meta.errors).toEqual([]);
  }
  const output = JSON.parse(
    parseOpenUIScenarioRaw(OPENUI_INLINE_TRIP_RAW),
  ) as Array<{ kind: string }>;
  expect(output.map(part => part.kind)).toEqual(parts.map(part => part.kind));
});

test('completes one block while the following block is still streaming', () => {
  const source =
    '# Intro\n```openui id=first\nroot = TextContent("First")\n```\nBetween\n~~~openui-lang id=second\nroot = TextContent("Sec';
  const parts = splitOpenUiResponse(source);
  expect(parts.map(part => part.kind)).toEqual([
    'text',
    'code',
    'text',
    'code',
  ]);
  expect(parts[1]?.complete).toBe(true);
  expect(parts[3]?.complete).toBe(false);
  expect(parts[2]?.content).toBe('Between\n');
  const closed = splitOpenUiResponse(
    source + 'Second'.slice(3) + '")\n~~~\nAfter',
  );
  expect(closed[3]?.complete).toBe(true);
  expect(closed[4]?.content).toBe('After');
});

test('preserves other language fences as ordinary Markdown', () => {
  const source =
    '## Example\n```typescript\nconst root = "not OpenUI";\n```\nAfter';
  expect(splitOpenUiResponse(source)).toEqual([{
    kind: 'text',
    content: source,
  }]);
});

test('keeps Markdown stable while an opening fence header arrives character by character', () => {
  const prefix = '# Ready\n\n';
  const header = '```openui-lang id=route';
  for (let end = 1; end <= header.length; end++) {
    expect(splitOpenUiResponse(prefix + header.slice(0, end), true)).toEqual([
      { kind: 'text', content: prefix },
    ]);
  }
  expect(splitOpenUiResponse(prefix + header + '\nroot = Card([])', true)[1])
    .toEqual({ kind: 'code', content: 'root = Card([])', complete: false });
});

test.each(['```', '~~~~'])(
  'keeps partial closing %s markers out of the OpenUI program',
  marker => {
    const code = 'root = Card([])\n';
    const prefix = `${marker}openui\n${code}`;
    for (let end = 1; end <= marker.length; end++) {
      expect(splitOpenUiResponse(prefix + marker.slice(0, end), true)[1])
        .toEqual({ kind: 'code', content: code, complete: false });
    }
    expect(splitOpenUiResponse(prefix + marker + '\n', true)[1]?.complete)
      .toBe(true);
    expect(splitOpenUiResponse(prefix + marker, false)[1]?.complete).toBe(true);
  },
);

test('shows an ordinary unfinished Markdown fence when the response completes', () => {
  const source = '# Code\n```typescript';
  expect(splitOpenUiResponse(source, true)).toEqual([
    { kind: 'text', content: '# Code\n' },
  ]);
  expect(splitOpenUiResponse(source, false)).toEqual([
    { kind: 'text', content: source },
  ]);
});

test('does not defer ordinary inline code or strikethrough text', () => {
  for (const source of ['`inline code`', '~~strikethrough~~']) {
    expect(splitOpenUiResponse(source, true)).toEqual([
      { kind: 'text', content: source },
    ]);
  }
});
