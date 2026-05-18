// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Input, TextArea } from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';

import {
  getTextFieldInputType,
  isTextFieldValueValid,
  normalizeTextFieldValue,
  normalizeTextFieldVariant,
} from './utils.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/TextField.css';

/**
 * @a2uiCatalog TextField
 */
export interface TextFieldProps extends GenericComponentProps {
  /** The text label for the input field. */
  label: string | { path: string };
  /** The value of the text field. */
  value?: string | { path: string };
  /** The type of input field to display. */
  variant?: 'longText' | 'number' | 'shortText' | 'obscured';
  /** A regular expression used for client-side validation of the input. */
  validationRegexp?: string;
  /** A list of checks to perform. */
  checks?: Array<{
    /** The condition that indicates whether the check passes. */
    condition:
      | boolean
      | { path: string }
      | {
        call: string;
        args?: Record<string, string | number | boolean | { path: string }>;
        returnType?: 'boolean';
      };
    /** The error message to display if the check fails. */
    message: string;
  }>;
}

export function TextField(
  props: TextFieldProps,
): import('@lynx-js/react').ReactNode {
  const { id, label, setValue, validationRegexp } = props;
  const textFieldType = props['textFieldType'];
  const variant = normalizeTextFieldVariant(props.variant, textFieldType);
  const resolvedValue = normalizeTextFieldValue(props.value);
  const labelText = normalizeTextFieldValue(label);
  const [draftValue, setDraftValue] = useState(resolvedValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setDraftValue(resolvedValue);
    return undefined;
  }, [resolvedValue]);

  const handleInput = (nextValue: string) => {
    setTouched(true);
    setDraftValue(nextValue);
    setValue?.('value', nextValue);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const invalid = !isTextFieldValueValid(draftValue, validationRegexp);
  const showInvalid = touched && invalid;
  const rootClassName = showInvalid
    ? `textfield textfield-${variant} textfield-invalid`
    : `textfield textfield-${variant}`;

  const controlClassName = variant === 'longText'
    ? 'textfield-control textfield-textarea'
    : 'textfield-control';
  const controlId = id ? `${id}-control` : undefined;
  const controlIdProps = controlId ? { id: controlId } : {};

  return (
    <view key={id} className={rootClassName}>
      <text className='textfield-label'>{labelText}</text>
      {variant === 'longText'
        ? (
          <TextArea
            {...controlIdProps}
            className={controlClassName}
            value={draftValue}
            maxLines={6}
            confirmType='done'
            onInput={handleInput}
            onBlur={handleBlur}
          />
        )
        : (
          <Input
            {...controlIdProps}
            className={controlClassName}
            value={draftValue}
            type={getTextFieldInputType(variant)}
            confirmType='done'
            onInput={handleInput}
            onBlur={handleBlur}
          />
        )}
      {showInvalid && <text className='textfield-error'>Invalid value</text>}
    </view>
  );
}
