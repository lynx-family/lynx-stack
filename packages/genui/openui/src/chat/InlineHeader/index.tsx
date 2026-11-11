// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { InlineHeader as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { Markdown } from '../markdown.jsx';
import '../../../styles/catalog/ChatInlineHeader.css';

/** Compact Chat heading and description with Markdown formatting. */
export const InlineHeader: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => (
    <view className='OpenUIChatInlineHeader'>
      {props.heading && (
        <view className='OpenUIChatInlineHeaderHeading'>
          <Markdown text={props.heading} />
        </view>
      )}
      {props.description && <Markdown text={props.description} size='small' />}
    </view>
  ),
};
