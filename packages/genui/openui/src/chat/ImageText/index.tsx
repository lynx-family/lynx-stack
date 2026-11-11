// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ImageText as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatImageText.css';

/** Chat image and label renderer. */
export const ImageText: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const vertical = props.layout === 'vertical';
    const size = Math.max(1, props.imageSize ?? (vertical ? 180 : 48));
    return (
      <view
        className={`OpenUIChatImageText ${
          vertical ? 'OpenUIChatImageTextVertical' : ''
        }`}
      >
        <image
          src={props.src ?? ''}
          accessibility-label={props.alt ?? props.title}
          mode='aspectFill'
          className='OpenUIChatImageTextImage'
          style={{
            width: vertical ? '100%' : `${size}px`,
            height: `${size}px`,
          }}
        />
        <view className='OpenUIChatImageTextLabels'>
          <text
            className={`OpenUIChatImageTextTitle ${
              props.bold ? 'OpenUIChatImageTextBold' : ''
            }`}
          >
            {props.title ?? ''}
          </text>
          {props.subtitle && (
            <text className='OpenUIChatImageTextSubtitle'>
              {props.subtitle}
            </text>
          )}
        </view>
      </view>
    );
  },
};
