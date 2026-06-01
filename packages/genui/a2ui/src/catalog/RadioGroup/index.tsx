// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Radio, RadioGroupRoot, RadioIndicator } from '@lynx-js/lynx-ui';

import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/RadioGroup.css';

const HitSlop = {
  'hit-slop': {
    top: '8px' as `${number}px`,
    left: '8px' as `${number}px`,
    right: '8px' as `${number}px`,
    bottom: '8px' as `${number}px`,
  },
};

/**
 * @a2uiCatalog RadioGroup
 */
export interface RadioGroupComponentProps extends GenericComponentProps {
  /** The list of string options to display. */
  items: string[] | { path: string } | {
    call: string;
    args: Record<string, unknown>;
    returnType?:
      | 'string'
      | 'number'
      | 'boolean'
      | 'array'
      | 'object'
      | 'any'
      | 'void';
  };
  /** The currently selected value. */
  value: string | { path: string } | {
    call: string;
    args: Record<string, unknown>;
    returnType?:
      | 'string'
      | 'number'
      | 'boolean'
      | 'array'
      | 'object'
      | 'any'
      | 'void';
  };
  /** A hint for the visual style of the radio group. */
  usageHint?: 'default' | 'card' | 'row';
  checks?: Array<{
    condition: boolean | { path: string } | {
      call: string;
      args: Record<string, unknown>;
      returnType?:
        | 'string'
        | 'number'
        | 'boolean'
        | 'array'
        | 'object'
        | 'any'
        | 'void';
    };
    message: string;
  }>;
}

export function RadioGroup(
  props: RadioGroupComponentProps,
): import('@lynx-js/react').ReactNode {
  const value = props.value;
  const items = props.items;
  const usageHint = (props.usageHint as string | undefined) ?? 'default';
  const setValue = props.setValue as
    | ((key: string, value: unknown) => void)
    | undefined;
  const explicitItems = Array.isArray(items) ? items : [];
  const checks = props.checks as CheckLike[] | undefined;

  const { ok, firstFailureMessage } = useChecks({
    checks,
    componentId: props.id ?? '',
    surface: props.surface,
    dataContextPath: props.dataContextPath,
  });

  const handleValueChange = (newValue: string) => {
    setValue?.('value', newValue);
  };

  return (
    <view
      className={`radio-group radio-group-${usageHint}${
        ok ? '' : ' radio-group-invalid'
      }`}
    >
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
      {!ok && firstFailureMessage
        ? <text className='radio-group-error'>{firstFailureMessage}</text>
        : null}
    </view>
  );
}
