// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { CompositeCardBlock as definition } from './definition.js';
import type { ActionLike } from '../../catalog/Action/index.jsx';
import {
  useFormName,
  useIsStreaming,
  useTriggerAction,
} from '../../core/context.jsx';
import type { DefinedComponent } from '../../core/library.jsx';
import { withItemContext } from '../cardAction.js';
import type { CompositeCardItem } from '../CompositeCardItem/definition.js';
import { childKey, childProps } from '../elements.js';
import '../../../styles/catalog/ChatCompositeCardBlock.css';

/** Chat product/offer cards in a wrapping grid or horizontal carousel. */
export const CompositeCardBlock: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => {
    const trigger = useTriggerAction();
    const form = useFormName();
    const streaming = useIsStreaming();
    const carousel = props.layout === 'carousel';
    const items = (props.items ?? []).map((node, index) => {
      const item = childProps<z.infer<typeof CompositeCardItem.props>>(node);
      const header = childProps<
        {
          title: string;
          value: string;
          subtitle: string;
          subtext: string;
          alt: string;
        }
      >(item.header);
      const title = header.title ?? header.value;
      const action = props.action as ActionLike | undefined;
      const onTap = action && !streaming
        ? () => {
          void trigger(
            title ?? header.alt ?? item.id ?? `Composite card ${index + 1}`,
            form,
            withItemContext(action, {
              itemIndex: index,
              itemId: item.id,
              itemHeaderTitle: title,
              itemHeaderSubtitle: header.subtitle ?? header.subtext,
              itemHeaderAlt: header.alt,
              itemBodyCount: item.body?.length ?? 0,
              itemFooterPrice:
                childProps<{ value: string }>(item.footer?.price).value,
              itemFooterButtonLabel:
                childProps<{ label: string }>(item.footer?.button).label,
            }),
          );
        }
        : undefined;
      return (
        <view
          key={childKey(node, index)}
          className={`OpenUIChatCompositeCard ${
            carousel
              ? 'OpenUIChatCompositeSlide'
              : (props.responsive === false ? 'OpenUIChatCompositeFixed' : '')
          }`}
        >
          <view
            className='OpenUIChatCompositeBody'
            bindtap={onTap}
            accessibility-role={onTap ? 'button' : undefined}
          >
            {renderNode(item.header)}
            {renderNode(item.body ?? [])}
          </view>
          {item.footer && (
            <view className='OpenUIChatCompositeFooter'>
              {renderNode(item.footer.price)}
              {renderNode(item.footer.button)}
            </view>
          )}
        </view>
      );
    });
    const content = (
      <view
        className={`OpenUIChatCompositeGrid ${
          carousel ? 'OpenUIChatCompositeCarousel' : ''
        }`}
        style={props.gap == null
          ? {}
          : {
            gap: typeof props.gap === 'number' ? `${props.gap}px` : props.gap,
          }}
      >
        {items}
      </view>
    );
    return carousel
      ? (
        <scroll-view
          scroll-orientation='horizontal'
          className='OpenUIChatCompositeScroll'
        >
          {content}
        </scroll-view>
      )
      : content;
  },
};
