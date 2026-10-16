// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentGroup } from '@openuidev/lang-core';

export const DEFAULT_COMPONENT_NAMES = [
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
  'Canvas',
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
] as const;

/** Select definitions in the shared order from either component catalog. */
export function getDefaultComponents<
  T extends Record<(typeof DEFAULT_COMPONENT_NAMES)[number], unknown>,
>(catalog: T) {
  return DEFAULT_COMPONENT_NAMES.map((name): T[typeof name] => catalog[name]);
}

export const DEFAULT_COMPONENT_GROUPS: ComponentGroup[] = [
  { name: 'Layout', components: ['Stack', 'Row', 'Column', 'List'] },
  {
    name: 'Content',
    components: [
      'Card',
      'CardHeader',
      'Text',
      'TextContent',
      'Separator',
      'Divider',
    ],
  },
  { name: 'Buttons', components: ['Button', 'Buttons'] },
  {
    name: 'Data Display',
    components: [
      'Tag',
      'Image',
      'Canvas',
      'Icon',
      'Video',
      'AudioPlayer',
      'Loading',
    ],
  },
  { name: 'Overlays', components: ['Tabs', 'Modal'] },
  {
    name: 'Inputs',
    components: [
      'CheckBox',
      'RadioGroup',
      'ChoicePicker',
      'Slider',
      'TextField',
      'DateTimeInput',
    ],
  },
];
