// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Separator as SeparatorDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/Separator.css';

export const Separator: DefinedComponent<typeof SeparatorDefinition.props> = {
  ...SeparatorDefinition,
  component: () => <view className='OpenUISeparator' />,
};
