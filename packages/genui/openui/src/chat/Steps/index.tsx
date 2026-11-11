// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { Steps as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { childKey, childProps } from '../elements.js';
import { Markdown } from '../markdown.jsx';
import type { StepsItem } from '../StepsItem/definition.js';
import '../../../styles/catalog/ChatSteps.css';

/** Vertical Chat steps with Markdown details. */
export const Steps: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => (
    <view className='OpenUIChatSteps'>
      {(props.items ?? []).map((node, index) => {
        const item = childProps<z.infer<typeof StepsItem.props>>(node);
        return (
          <view className='OpenUIChatStep' key={childKey(node, index)}>
            <text className='OpenUIChatStepNumber'>{index + 1}</text>
            <view className='OpenUIChatStepBody'>
              <text className='OpenUIChatStepTitle'>{item.title ?? ''}</text>
              <Markdown text={item.details ?? ''} size='small' />
            </view>
          </view>
        );
      })}
    </view>
  ),
};
