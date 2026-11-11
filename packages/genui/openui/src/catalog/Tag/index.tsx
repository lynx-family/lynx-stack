// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Tag as TagDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/Tag.css';

export const Tag: DefinedComponent<typeof TagDefinition.props> = {
  ...TagDefinition,
  component: ({ props }) => (
    <view className='OpenUITag'>
      <text className='OpenUITagText'>{props.text}</text>
    </view>
  ),
};
