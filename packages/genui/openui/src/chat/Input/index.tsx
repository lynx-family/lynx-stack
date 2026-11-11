// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Input as LynxInput } from '@lynx-js/lynx-ui';

import { Input as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { useChatField } from '../useChatField.js';
import '../../../styles/catalog/ChatInput.css';

/** Chat input backed by a named form field or reactive binding. */
export const Input: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const field = useChatField(props.name, props.value, '', props.rules);
    return (
      <view className='OpenUIChatInputGroup'>
        <LynxInput
          id={props.name}
          className={`OpenUIChatInput ${
            field.error ? 'OpenUIChatInputInvalid' : ''
          }`}
          type={props.type === 'url' ? 'text' : props.type ?? 'text'}
          placeholder={props.placeholder ?? ''}
          value={field.value}
          readonly={field.streaming}
          maxLength={-1}
          onInput={value => {
            field.set(value);
            field.clearError();
          }}
          onFocus={field.clearError}
          onBlur={field.validate}
        />
        {field.error && (
          <text className='OpenUIChatInputError'>{field.error}</text>
        )}
      </view>
    );
  },
};
