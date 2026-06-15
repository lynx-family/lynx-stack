// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  Checkbox,
  CheckboxIndicator,
  Input,
  Radio,
  RadioGroupRoot,
  RadioIndicator,
} from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import {
  filterChoicePickerOptions,
  normalizeChoicePickerDisplayStyle,
  normalizeChoicePickerLabel,
  normalizeChoicePickerOptions,
  normalizeChoicePickerValue,
  normalizeChoicePickerVariant,
  toggleChoicePickerValue,
} from './utils.js';
import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/ChoicePicker.css';

const HitSlop = {
  'hit-slop': {
    top: '8px' as `${number}px`,
    left: '8px' as `${number}px`,
    right: '8px' as `${number}px`,
    bottom: '8px' as `${number}px`,
  },
};

/**
 * Props for the built-in ChoicePicker catalog component.
 *
 * @a2uiCatalog ChoicePicker
 */
export interface ChoicePickerProps extends GenericComponentProps {
  /** The label for the group of options. */
  label?: string | { path: string } | {
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
  /** A hint for how the choice picker should be displayed and behave. */
  variant?: 'multipleSelection' | 'mutuallyExclusive';
  /** The list of available options to choose from. */
  options: Array<{
    /** The text to display for this option. */
    label: string | { path: string } | {
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
    /** The stable value associated with this option. */
    value: string;
  }>;
  /** The list of currently selected values. */
  value: string[] | { path: string } | {
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
  /** The display style of the component. */
  displayStyle?: 'checkbox' | 'chips';
  /** If true, displays a search input to filter the options. */
  filterable?: boolean;
  /** A list of checks to perform. */
  checks?: Array<{
    /** The condition that indicates whether the check passes. */
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
    /** The error message to display if the check fails. */
    message: string;
  }>;
}

/**
 * Render a single- or multi-select choice picker.
 */
export function ChoicePicker(
  props: ChoicePickerProps,
): import('@lynx-js/react').ReactNode {
  const {
    dataContextPath,
    filterable = false,
    id,
    label,
    setValue,
    surface,
  } = props;
  const [query, setQuery] = useState('');
  const options = normalizeChoicePickerOptions(props.options);
  const variant = normalizeChoicePickerVariant(props.variant);
  const displayStyle = normalizeChoicePickerDisplayStyle(props.displayStyle);
  const selectedValues = normalizeChoicePickerValue(props.value, options);
  const selectedValue = selectedValues[0] ?? '';
  const visibleOptions = filterChoicePickerOptions(options, query);
  const checks = props.checks as CheckLike[] | undefined;

  const { ok, firstFailureMessage } = useChecks({
    checks,
    componentId: id ?? '',
    surface,
    dataContextPath,
  });

  const handleExclusiveChange = (nextValue: string) => {
    if (!nextValue || selectedValue === nextValue) return;
    setValue?.('value', [nextValue]);
  };

  const handleMultipleChange = (optionValue: string) => {
    setValue?.(
      'value',
      toggleChoicePickerValue(selectedValues, optionValue, variant),
    );
  };

  const rootClassName = [
    'choice-picker',
    `choice-picker-${displayStyle}`,
    `choice-picker-${variant}`,
    ok ? '' : 'choice-picker-invalid',
  ].filter(Boolean).join(' ');
  const labelText = normalizeChoicePickerLabel(label);

  return (
    <view key={id} className={rootClassName}>
      {labelText
        ? <text className='choice-picker-label'>{labelText}</text>
        : null}
      {filterable
        ? (
          <Input
            className='choice-picker-filter'
            value={query}
            type='text'
            confirmType='done'
            onInput={setQuery}
          />
        )
        : null}
      {variant === 'mutuallyExclusive'
        ? (
          <RadioGroupRoot
            value={selectedValue}
            onValueChange={handleExclusiveChange}
          >
            <view className='choice-picker-options'>
              {visibleOptions.map((option) =>
                displayStyle === 'chips'
                  ? (
                    <Radio
                      key={option.value}
                      className='choice-picker-chip'
                      value={option.value}
                      radioProps={HitSlop}
                    >
                      <text className='choice-picker-chip-text'>
                        {option.label}
                      </text>
                    </Radio>
                  )
                  : (
                    <Radio
                      key={option.value}
                      className='choice-picker-option'
                      value={option.value}
                      radioProps={HitSlop}
                    >
                      <RadioIndicator
                        forceMount
                        className='choice-picker-radio-indicator'
                      >
                        <view className='choice-picker-radio-dot' />
                      </RadioIndicator>
                      <text className='choice-picker-option-text'>
                        {option.label}
                      </text>
                    </Radio>
                  )
              )}
            </view>
          </RadioGroupRoot>
        )
        : (
          <view className='choice-picker-options'>
            {visibleOptions.map((option) => {
              const checked = selectedValues.includes(option.value);
              return displayStyle === 'chips'
                ? (
                  <Checkbox
                    key={option.value}
                    className='choice-picker-chip'
                    checked={checked}
                    onChange={() => handleMultipleChange(option.value)}
                    checkboxProps={HitSlop}
                  >
                    <text className='choice-picker-chip-text'>
                      {option.label}
                    </text>
                  </Checkbox>
                )
                : (
                  <Checkbox
                    key={option.value}
                    className='choice-picker-option'
                    checked={checked}
                    onChange={() => handleMultipleChange(option.value)}
                    checkboxProps={HitSlop}
                  >
                    <CheckboxIndicator
                      forceMount
                      className='choice-picker-checkbox-indicator'
                    >
                      <text className='choice-picker-checkmark'>✓</text>
                    </CheckboxIndicator>
                    <text className='choice-picker-option-text'>
                      {option.label}
                    </text>
                  </Checkbox>
                );
            })}
          </view>
        )}
      {!ok && firstFailureMessage
        ? <text className='choice-picker-error'>{firstFailureMessage}</text>
        : null}
    </view>
  );
}
