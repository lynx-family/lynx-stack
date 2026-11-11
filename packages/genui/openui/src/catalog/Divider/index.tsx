// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Divider as DividerDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/Divider.css';

export const Divider: DefinedComponent<typeof DividerDefinition.props> = {
  ...DividerDefinition,
  component: ({ props }) => {
    const axis = props.axis === 'vertical' ? 'Vertical' : 'Horizontal';
    return <view className={`OpenUIDivider OpenUIDivider${axis}`} />;
  },
};
