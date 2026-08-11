// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentGroup, DefinedComponent } from './library.jsx';
import * as c from '../catalog/index.js';

export const DEFAULT_COMPONENTS: DefinedComponent<any>[] = [
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
