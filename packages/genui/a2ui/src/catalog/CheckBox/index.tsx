// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

/**
 * Props for the CheckBox catalog component.
 */
export interface CheckBoxProps extends GenericComponentProps {
  label: string | { path: string };
  value: boolean | { path: string };
}

/**
 * Render a checkbox row.
 */
export function CheckBox(
  props: CheckBoxProps,
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
