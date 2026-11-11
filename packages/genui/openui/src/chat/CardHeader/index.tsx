// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { CardHeader as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatCardHeader.css';

/** Chat card heading with independently optional title and subtitle. */
export const CardHeader: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => (
    <view className='OpenUIChatCardHeader'>
      {props.title && (
        <text className='OpenUIChatCardHeaderTitle'>{props.title}</text>
      )}
      {props.subtitle && (
        <text className='OpenUIChatCardHeaderSubtitle'>{props.subtitle}</text>
      )}
    </view>
  ),
};
