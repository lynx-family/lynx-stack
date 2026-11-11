// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { CardHeader as CardHeaderDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/CardHeader.css';

export const CardHeader: DefinedComponent<typeof CardHeaderDefinition.props> = {
  ...CardHeaderDefinition,
  component: ({ props }) => (
    <view className='OpenUICardHeader'>
      <text className='OpenUICardHeaderTitle'>{props.title}</text>
      {props.subtitle
        ? <text className='OpenUICardHeaderSubtitle'>{props.subtitle}</text>
        : null}
    </view>
  ),
};
