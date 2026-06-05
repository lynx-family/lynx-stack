// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ActionPlan } from '@openuidev/lang-core';
import { BuiltinActionType } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Input, TextArea } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import { useTriggerAction } from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import { actionPropSchema } from '../Action/index.jsx';

const CONTINUE_CONVERSATION_ACTION = String(
  BuiltinActionType.ContinueConversation,
);
const OPEN_URL_ACTION = String(BuiltinActionType.OpenUrl);

const TEXT_FIELD_VARIANTS = [
  'longText',
  'number',
  'shortText',
  'obscured',
] as const;

const textFieldPropsSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  variant: z.enum(TEXT_FIELD_VARIANTS).optional(),
  validationRegexp: z.string().optional(),
  action: actionPropSchema.optional(),
});

type TextFieldProps = z.infer<typeof textFieldPropsSchema>;

function normalizeVariant(
  variant: unknown,
): typeof TEXT_FIELD_VARIANTS[number] {
  return TEXT_FIELD_VARIANTS.includes(
      variant as typeof TEXT_FIELD_VARIANTS[number],
    )
    ? variant as typeof TEXT_FIELD_VARIANTS[number]
    : 'shortText';
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' || typeof value === 'boolean'
    || typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

function isValueValid(value: string, regexp: string | undefined): boolean {
  if (!regexp) return true;
  try {
    return new RegExp(regexp).test(value);
  } catch {
    return true;
  }
}

function TextFieldRenderer({ props }: { props: TextFieldProps }) {
  const triggerAction = useTriggerAction();
  const variant = normalizeVariant(props.variant);
  const [draft, setDraft] = useState<string>(normalizeValue(props.value));
  const invalid = !isValueValid(draft, props.validationRegexp);
  const showInvalid = invalid && draft.length > 0;

  const onInput = (next: string) => {
    setDraft(next);
    if (!props.action) return;
    if ('steps' in props.action) {
      void triggerAction(next, undefined, props.action as ActionPlan);
      return;
    }
    const legacyAction = props.action;
    const actionType = legacyAction?.type ?? CONTINUE_CONVERSATION_ACTION;
    const actionParams = actionType === OPEN_URL_ACTION
      ? { url: legacyAction?.url }
      : {
        ...(legacyAction?.params ?? {}),
        ...(legacyAction?.context ? { context: legacyAction.context } : {}),
      };
    void triggerAction(next, undefined, {
      type: actionType,
      params: actionParams,
    });
  };

  const rootClassName = showInvalid
    ? `OpenUITextField OpenUITextField-${variant} OpenUITextField-invalid`
    : `OpenUITextField OpenUITextField-${variant}`;

  const controlClassName = variant === 'longText'
    ? 'OpenUITextFieldControl OpenUITextFieldTextarea'
    : 'OpenUITextFieldControl';

  return (
    <view className={rootClassName}>
      <text className='OpenUITextFieldLabel'>{props.label}</text>
      {variant === 'longText'
        ? (
          <TextArea
            className={controlClassName}
            value={draft}
            maxLines={6}
            confirmType='done'
            onInput={onInput}
          />
        )
        : (
          <Input
            className={controlClassName}
            value={draft}
            type={variant === 'number'
              ? 'number'
              : (variant === 'obscured'
                ? 'password'
                : 'text')}
            confirmType='done'
            onInput={onInput}
          />
        )}
      {showInvalid
        ? <text className='OpenUITextFieldError'>Invalid value</text>
        : null}
    </view>
  );
}

export const TextField = defineComponent({
  name: 'TextField',
  props: textFieldPropsSchema,
  description:
    'Single-line or multi-line text input. Supports shortText, number, obscured (password), and longText (multi-line) variants with optional regex validation.',
  component: TextFieldRenderer,
});
