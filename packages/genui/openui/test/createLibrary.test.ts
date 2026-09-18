// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import { Stack } from '../src/catalog/Stack/index.jsx';
import { TextContent } from '../src/catalog/TextContent/index.jsx';
import { createOpenUiLibrary } from '../src/core/createLibrary.jsx';
import {
  createOpenUiLibrary as createExplicitOpenUiLibrary,
} from '../src/core/explicit.js';

test('includes the built-in components and groups by default', () => {
  const library = createOpenUiLibrary();

  expect(Object.keys(library.components)).toEqual([
    'Stack',
    'Row',
    'Column',
    'List',
    'Card',
    'CardHeader',
    'Text',
    'TextContent',
    'Separator',
    'Divider',
    'Button',
    'Buttons',
    'Tag',
    'Image',
    'Icon',
    'Video',
    'AudioPlayer',
    'Loading',
    'Tabs',
    'Modal',
    'CheckBox',
    'RadioGroup',
    'ChoicePicker',
    'Slider',
    'TextField',
    'DateTimeInput',
  ]);
  expect(library.componentGroups).toHaveLength(6);
});

test('uses only caller-provided components and groups when defaults are disabled', () => {
  const componentGroups = [
    { name: 'Selected', components: ['Stack', 'TextContent'] },
  ];
  const library = createOpenUiLibrary({
    includeDefaultComponents: false,
    components: [Stack, TextContent],
    componentGroups,
  });

  expect(Object.keys(library.components)).toEqual(['Stack', 'TextContent']);
  expect(library.componentGroups).toEqual(componentGroups);
  expect(library.root).toBe('Stack');
});

test('omits component groups when disabled defaults are not replaced', () => {
  const library = createOpenUiLibrary({
    includeDefaultComponents: false,
    components: [Stack],
  });

  expect(library.componentGroups).toBeUndefined();
});

test('requires callers to provide the root component when defaults are disabled', () => {
  expect(() => createOpenUiLibrary({ includeDefaultComponents: false }))
    .toThrow('Root component "Stack" was not found in components');
});

test('the explicit entry creates a Library from selected catalog components', () => {
  const library = createExplicitOpenUiLibrary({
    includeDefaultComponents: false,
    components: [Stack, TextContent],
  });

  expect(Object.keys(library.components)).toEqual(['Stack', 'TextContent']);
  expect(library.componentGroups).toBeUndefined();
});
