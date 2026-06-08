// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createLibrary } from './library.jsx';
import type { ComponentGroup, DefinedComponent, Library } from './library.jsx';
import * as c from '../catalog/index.js';

export interface CreateOpenUiLibraryOptions {
  /** Override the root component name. Defaults to `'Stack'`. */
  root?: string;
  /** Replace or extend the built-in component set. */
  components?: DefinedComponent<any>[];
  /** Replace or extend the built-in component groups. */
  componentGroups?: ComponentGroup[];
}

const DEFAULT_COMPONENTS: DefinedComponent<any>[] = [
  c.Stack,
  c.Card,
  c.CardHeader,
  c.TextContent,
  c.Separator,
  c.Button,
  c.Buttons,
  c.Tag,
  c.Image,
  c.Icon,
  c.Loading,
  c.CheckBox,
  c.RadioGroup,
  c.Slider,
  c.TextField,
];

const DEFAULT_COMPONENT_GROUPS: ComponentGroup[] = [
  { name: 'Layout', components: ['Stack'] },
  {
    name: 'Content',
    components: ['Card', 'CardHeader', 'TextContent', 'Separator'],
  },
  { name: 'Buttons', components: ['Button', 'Buttons'] },
  { name: 'Data Display', components: ['Tag', 'Image', 'Icon', 'Loading'] },
  {
    name: 'Inputs',
    components: ['CheckBox', 'RadioGroup', 'Slider', 'TextField'],
  },
];

export function createOpenUiLibrary(
  options?: CreateOpenUiLibraryOptions,
): Library {
  return createLibrary({
    root: options?.root ?? 'Stack',
    components: options?.components
      ? [...DEFAULT_COMPONENTS, ...options.components]
      : DEFAULT_COMPONENTS,
    componentGroups: options?.componentGroups
      ? [...DEFAULT_COMPONENT_GROUPS, ...options.componentGroups]
      : DEFAULT_COMPONENT_GROUPS,
  });
}
