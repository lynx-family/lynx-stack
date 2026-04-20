// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import type { ComponentProps } from '../../core/ComponentRegistry.js';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export interface CheckBoxProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function CheckBox(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const { id, label = 'CheckBox', value, setValue } = props;

  const handleChange = () => {
    setValue?.('value', !value);
  };

  return (
    <view key={id} className='checkbox-row' bindtap={handleChange}>
      <view className='checkbox-input'>
        {!!value && <text>✓</text>}
      </view>
      <text className='checkbox-label'>{label as string}</text>
    </view>
  );
}
