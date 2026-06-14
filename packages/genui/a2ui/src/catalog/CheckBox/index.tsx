// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/CheckBox.css';

/**
 * Props for the built-in CheckBox catalog component.
 *
 * @a2uiCatalog CheckBox
 */
export interface CheckBoxProps extends GenericComponentProps {
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
  value: boolean | { path: string } | {
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

/**
 * Render a boolean checkbox bound to the surface data model.
 */
export function CheckBox(
  props: CheckBoxProps,
): import('@lynx-js/react').ReactNode {
  const {
    id,
    label = 'CheckBox',
    value,
    setValue,
    surface,
    dataContextPath,
  } = props;
  const checks = props.checks as CheckLike[] | undefined;

  const { ok, firstFailureMessage } = useChecks({
    checks,
    componentId: id ?? '',
    surface,
    dataContextPath,
  });

  const handleChange = () => {
    setValue?.('value', !value);
  };

  return (
    <view
      key={id}
      className={`checkbox-row${ok ? '' : ' checkbox-row-invalid'}`}
      bindtap={handleChange}
    >
      <view
        className={`checkbox-input ${value ? 'checkbox-input-checked' : ''}`
          .trim()}
      >
        {!!value && <text>✓</text>}
      </view>
      <text className='checkbox-label'>{label as string}</text>
      {!ok && firstFailureMessage
        ? <text className='checkbox-error'>{firstFailureMessage}</text>
        : null}
    </view>
  );
}
