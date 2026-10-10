// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createParser } from '@openuidev/lang-core';
import { expect, test } from '@rstest/core';

import { createOpenUiLibrary } from '../src/core/createLibrary.jsx';
import {
  buildOpenUiSystemPrompt,
  createOpenUiPromptLibrary,
} from '../src/openui-prompt/index.js';

test.each(['renderer', 'prompt'])(
  '%s List preserves the optional items slot before layout arguments',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const parse = (call: string) =>
      createParser(library.toJSONSchema(), library.root).parse(
        `root = Stack([greetList])\ngreetList = ${call}`,
      );
    const invalid = parse(
      'List([Text("Hello")], "vertical", "stretch", "s", false)',
    );
    expect(
      invalid.meta.errors.map(error => ({
        code: error.code,
        path: error.path,
      })),
    ).toEqual([
      { code: 'type-mismatch', path: '/direction' },
      { code: 'type-mismatch', path: '/align' },
      { code: 'type-mismatch', path: '/gap' },
    ]);
    const valid = parse(
      'List([Text("Hello")], null, "vertical", "stretch", "s", false)',
    );
    expect(valid.meta.errors).toEqual([]);
    expect(valid.meta.unresolved).toEqual([]);
    expect(valid.meta.incomplete).toBe(false);
    expect(valid.root).toMatchObject({
      typeName: 'Stack',
      props: {
        children: [{
          typeName: 'List',
          props: {
            direction: 'vertical',
            align: 'stretch',
            gap: 's',
            divider: false,
          },
        }],
      },
    });
  },
);

test.each([
  { componentNames: undefined },
  { componentNames: ['Stack', 'List', 'Text'] },
])(
  'teaches null placeholders with component selection %s',
  ({ componentNames }) => {
    const prompt = buildOpenUiSystemPrompt(
      componentNames ? { componentNames } : {},
    );
    expect(prompt).toContain(
      'use null for every skipped optional slot before a later argument',
    );
    expect(prompt).toContain(
      'List(children, null, "vertical", "stretch", "s", false)',
    );
  },
);

test('the default List layout example parses against the renderer contract', () => {
  const line = buildOpenUiSystemPrompt().split('\n').find(text =>
    text.startsWith('details = List(')
  );
  expect(line).toBeDefined();
  expect(line).toContain('], null, "vertical", "stretch", "s", false)');
  const library = createOpenUiLibrary();
  const result = createParser(library.toJSONSchema(), library.root).parse(
    `root = Stack([details])\n${line}`,
  );
  expect(result.root).not.toBeNull();
  expect(result.meta.errors).toEqual([]);
  expect(result.meta.unresolved).toEqual([]);
  expect(result.meta.incomplete).toBe(false);
});

test.each([
  { componentNames: undefined },
  { componentNames: ['Stack', 'TextContent', 'Icon'] },
  { componentNames: ['Stack'] },
])(
  'teaches closed component enums with component selection %s',
  ({ componentNames }) => {
    const prompt = buildOpenUiSystemPrompt(
      componentNames ? { componentNames } : {},
    );
    expect(prompt).toContain('Treat every component enum as a closed set');
    expect(prompt).toContain(
      'use only the exact values listed for that argument',
    );
    expect(prompt).toContain(
      'Do not borrow enum values from another component',
    );
    expect(prompt).toContain('or from the broader upstream UI or icon library');
    expect(prompt).toContain(
      'use another available component instead of inventing a value',
    );
  },
);

test.each(['renderer', 'prompt'])(
  '%s distinguishes TextContent size from Text variant for footer notes',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const parse = (call: string) =>
      createParser(library.toJSONSchema(), library.root).parse(
        `root = Stack([footerNote])\nfooterNote = ${call}`,
      );
    const invalid = parse('TextContent("Footer note", "caption")');
    expect(
      invalid.meta.errors.map(error => ({
        code: error.code,
        path: error.path,
      })),
    ).toEqual([{ code: 'type-mismatch', path: '/size' }]);

    for (
      const call of [
        'TextContent("Footer note", "small")',
        'Text("Footer note", "caption")',
      ]
    ) {
      const valid = parse(call);
      expect(valid.root).not.toBeNull();
      expect(valid.meta.errors).toEqual([]);
      expect(valid.meta.unresolved).toEqual([]);
      expect(valid.meta.incomplete).toBe(false);
    }
  },
);

test.each(['renderer', 'prompt'])(
  '%s rejects unsupported flight icons and accepts supported names',
  kind => {
    const library = kind === 'renderer'
      ? createOpenUiLibrary()
      : createOpenUiPromptLibrary();
    const parse = (name: string) =>
      createParser(library.toJSONSchema(), library.root).parse(
        `root = Stack([headerTop])\nheaderTop = Icon("${name}")`,
      );
    const invalid = parse('flight');
    expect(
      invalid.meta.errors.map(error => ({
        code: error.code,
        path: error.path,
      })),
    ).toEqual([{ code: 'type-mismatch', path: '/name' }]);

    const valid = parse('location_on');
    expect(valid.root).not.toBeNull();
    expect(valid.meta.errors).toEqual([]);
    expect(valid.meta.unresolved).toEqual([]);
    expect(valid.meta.incomplete).toBe(false);
  },
);
