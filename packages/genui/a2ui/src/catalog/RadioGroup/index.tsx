// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Radio, RadioGroupRoot, RadioIndicator } from '@lynx-js/lynx-ui';

import type { ComponentProps } from '../../core/ComponentRegistry.js';
import type {
  ComponentInstance,
  GenericComponentProps,
} from '../../core/types.js';

import './style.css';

const HitSlop = {
  'hit-slop': {
    top: '8px' as `${number}px`,
    left: '8px' as `${number}px`,
    right: '8px' as `${number}px`,
    bottom: '8px' as `${number}px`,
  },
};

export interface RadioGroupProps extends ComponentProps {
  component: ComponentInstance & { dataContextPath?: string };
}

export function RadioGroup(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const value = props['value'];
  const items = props['items'];
  const usageHint = (props['usageHint'] as string | undefined) ?? 'default';
  const setValue = props.setValue as
    | ((key: string, value: unknown) => void)
    | undefined;
  const explicitItems = Array.isArray(items) ? items : [];

  const handleValueChange = (newValue: string) => {
    setValue?.('value', newValue);
  };

  return (
    <view className={`radio-group radio-group-${usageHint}`}>
      <RadioGroupRoot value={value as string} onValueChange={handleValueChange}>
        <view className='radio-group-container'>
          {explicitItems.map((itemValue: string) => (
            <view key={itemValue} className='radio-option'>
              <Radio
                className='radio-item'
                value={itemValue}
                radioProps={HitSlop}
              >
                <RadioIndicator className='radio-indicator'>
                  <view className='radio-indicator-dot' />
                </RadioIndicator>
              </Radio>
              <text className='label'>{itemValue}</text>
            </view>
          ))}
        </view>
      </RadioGroupRoot>
    </view>
  );
}
