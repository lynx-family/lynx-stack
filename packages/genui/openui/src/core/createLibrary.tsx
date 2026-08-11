// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createOpenUiLibraryWithDefaults } from './createLibraryBase.js';
import type { CreateOpenUiLibraryOptions } from './createLibraryBase.js';
import type { ComponentGroup, DefinedComponent, Library } from './library.jsx';
import * as c from '../catalog/index.js';

export type { CreateOpenUiLibraryOptions } from './createLibraryBase.js';

const DEFAULT_COMPONENTS: DefinedComponent<any>[] = [
  c.Stack,
  c.Row,
  c.Column,
  c.List,
  c.Card,
  c.CardHeader,
  c.Text,
  c.TextContent,
  c.Separator,
  c.Divider,
  c.Button,
  c.Buttons,
  c.Tag,
  c.Image,
  c.Icon,
  c.Video,
  c.AudioPlayer,
  c.Loading,
  c.Tabs,
  c.Modal,
  c.CheckBox,
  c.RadioGroup,
  c.ChoicePicker,
  c.Slider,
  c.TextField,
  c.DateTimeInput,
];

const DEFAULT_COMPONENT_GROUPS: ComponentGroup[] = [
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
    components: ['Tag', 'Image', 'Icon', 'Video', 'AudioPlayer', 'Loading'],
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

/**
 * Create a ReactLynx OpenUI library with caller-provided components and,
 * unless disabled, the built-in components.
 */
export function createOpenUiLibrary(
  options?: CreateOpenUiLibraryOptions,
): Library {
  return createOpenUiLibraryWithDefaults(options, {
    components: DEFAULT_COMPONENTS,
    componentGroups: DEFAULT_COMPONENT_GROUPS,
  });
}
