// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { ListBlock as definition } from './definition.js';
import type { ActionLike } from '../../catalog/Action/index.jsx';
import { useIsStreaming, useTriggerAction } from '../../core/context.jsx';
import type { DefinedComponent } from '../../core/library.jsx';
import { childKey, childProps } from '../elements.js';
import type { ListItem } from '../ListItem/definition.js';
import '../../../styles/catalog/ChatListBlock.css';

/** Chat list renderer with optional item actions. */
export const ListBlock: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const trigger = useTriggerAction();
    const streaming = useIsStreaming();
    return (
      <view
        className={`OpenUIChatList ${
          props.size === 'small' ? 'OpenUIChatListSmall' : ''
        }`}
      >
        {(props.items ?? []).map((node, index) => {
          const item = childProps<z.infer<typeof ListItem.props>>(node);
          return (
            <view
              key={childKey(node, index)}
              className='OpenUIChatListRow'
              accessibility-role={item.action ? 'button' : undefined}
              bindtap={item.action && !streaming
                ? () => {
                  void trigger(
                    item.title ?? '',
                    undefined,
                    item.action as ActionLike,
                  );
                }
                : undefined}
            >
              {props.variant === 'image'
                ? item.image && (
                  <image
                    className='OpenUIChatListImage'
                    src={item.image.src}
                    mode='aspectFill'
                    accessibility-label={item.image.alt}
                  />
                )
                : <text className='OpenUIChatListNumber'>{index + 1}.</text>}
              <view className='OpenUIChatListBody'>
                <text className='OpenUIChatListTitle'>{item.title ?? ''}</text>
                {item.subtitle && (
                  <text className='OpenUIChatListSubtitle'>
                    {item.subtitle}
                  </text>
                )}
              </view>
              {item.action && (
                <text className='OpenUIChatListAction'>
                  {item.actionLabel ?? '›'}
                </text>
              )}
            </view>
          );
        })}
      </view>
    );
  },
};
