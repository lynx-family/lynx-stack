// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { TextArea as LynxTextArea } from '@lynx-js/lynx-ui';

import { TextArea as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { useChatField } from '../useChatField.js';
import '../../../styles/catalog/ChatTextArea.css';

/** Chat multiline field with validation, reactive state and three visible rows by default. */
export const TextArea: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const field = useChatField(props.name, props.value, '', props.rules);
    const rows = Math.max(1, Math.floor(props.rows ?? 3));
    return (
      <view className='OpenUIChatTextAreaGroup'>
        <view
          className={`OpenUIChatTextAreaFrame ${
            field.error ? 'OpenUIChatTextAreaInvalid' : ''
          }`}
        >
          <LynxTextArea
            id={props.name}
            className='OpenUIChatTextArea'
            style={{ height: `${rows * 40}rpx` }}
            placeholder={props.placeholder ?? ''}
            value={field.value}
            readonly={field.streaming}
            maxLength={-1}
            // rows controls the visible height, not the number of lines users may enter.
            maxLines={2_147_483_647}
            onInput={value => {
              field.set(value);
              field.clearError();
            }}
            onFocus={field.clearError}
            onBlur={field.validate}
          />
        </view>
        {field.error && (
          <text className='OpenUIChatTextAreaError'>{field.error}</text>
        )}
      </view>
    );
  },
};
