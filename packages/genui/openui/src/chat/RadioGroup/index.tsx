// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { Radio, RadioGroupRoot, RadioIndicator } from '@lynx-js/lynx-ui';

import { RadioGroup as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { childProps } from '../elements.js';
import type { RadioItem } from '../RadioItem/definition.js';
import { useChatField } from '../useChatField.js';
import '../../../styles/catalog/ChatRadioGroup.css';

/** Chat radio group with stable values and optional descriptions. */
export const RadioGroup: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const field = useChatField(
      props.name,
      props.value,
      props.defaultValue ?? '',
      props.rules,
    );
    return (
      <view className='OpenUIChatRadioGroup'>
        <RadioGroupRoot
          value={field.value}
          disabled={field.streaming}
          onValueChange={value => {
            field.set(value);
            field.validate(value);
          }}
        >
          <view className='OpenUIChatRadioOptions'>
            {(props.items ?? []).map(node => {
              const item = childProps<z.infer<typeof RadioItem.props>>(node);
              return (
                <Radio
                  key={item.value}
                  value={item.value ?? ''}
                  className='OpenUIChatRadioOption'
                >
                  <RadioIndicator className='OpenUIChatRadioIndicator'>
                    <view className='OpenUIChatRadioDot' />
                  </RadioIndicator>
                  <view className='OpenUIChatRadioLabels'>
                    <text className='OpenUIChatRadioLabel'>
                      {item.label ?? ''}
                    </text>
                    {item.description && (
                      <text className='OpenUIChatRadioDescription'>
                        {item.description}
                      </text>
                    )}
                  </view>
                </Radio>
              );
            })}
          </view>
        </RadioGroupRoot>
        {field.error && (
          <text className='OpenUIChatRadioError'>{field.error}</text>
        )}
      </view>
    );
  },
};
