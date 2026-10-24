// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ProductFeature as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { Markdown } from '../markdown.jsx';
import { useOpenLink } from '../sources.jsx';
import '../../../styles/catalog/ChatProductFeature.css';

/** Document-specific product feature extension, separate from upstream Chat. */
export const ProductFeature: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const open = useOpenLink();
    return (
      <view className='OpenUIChatProductFeature'>
        <image
          src={props.src ?? ''}
          mode='aspectFit'
          accessibility-label={props.alt}
          className='OpenUIChatProductImage'
        />
        <view className='OpenUIChatProductBody'>
          <text className='OpenUIChatProductTitle'>{props.title ?? ''}</text>
          <text className='OpenUIChatProductSubtitle'>
            {props.subtitle ?? ''}
          </text>
          {(props.paragraphs ?? []).map((paragraph, index) => (
            <Markdown text={paragraph} size='small' key={index} />
          ))}
          <text
            className='OpenUIChatProductPrice'
            bindtap={() => open(props.title ?? '', props.url)}
          >
            {props.price ?? ''}
          </text>
        </view>
      </view>
    );
  },
};
