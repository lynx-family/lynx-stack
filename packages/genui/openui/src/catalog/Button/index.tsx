// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ACTION_STEPS, BuiltinActionType } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import type { ReactNode } from '@lynx-js/react';

import {
  useFormName,
  useIsStreaming,
  useTriggerAction,
} from '../../core/context.jsx';
import { useFormValidation } from '../../core/hooks/index.js';
import { defineComponent } from '../../core/library.jsx';
import { actionPropSchema } from '../Action/index.jsx';
import type { ActionLike } from '../Action/index.jsx';
import { asArray } from '../utils.js';

import '../../../styles/catalog/Button.css';

const CONTINUE_CONVERSATION_ACTION = String(
  BuiltinActionType.ContinueConversation,
);
const OPEN_URL_ACTION = String(BuiltinActionType.OpenUrl);

const buttonPropsSchema = z.object({
  label: z.string(),
  action: actionPropSchema.optional(),
  variant: z.enum(['primary', 'secondary', 'tertiary']).optional(),
  type: z.enum(['normal', 'destructive']).optional(),
  size: z.enum(['extra-small', 'small', 'medium', 'large']).optional(),
});

type ButtonProps = z.infer<typeof buttonPropsSchema>;

function ButtonRenderer({ props }: { props: ButtonProps }) {
  const triggerAction = useTriggerAction();
  const formName = useFormName();
  const isStreaming = useIsStreaming();
  const formValidation = useFormValidation();

  const label = String(props.label ?? '');
  const variant = props.variant ?? 'primary';
  const action = props.action as ActionLike | undefined;

  let className = 'OpenUIButton OpenUIButtonPrimary';
  if (variant === 'secondary') {
    className = 'OpenUIButton OpenUIButtonSecondary';
  } else if (variant === 'tertiary') {
    className = 'OpenUIButton OpenUIButtonGhost';
  }

  const onTap = () => {
    const legacyAction = action && !('steps' in action) ? action : undefined;
    const actionType = legacyAction?.type ?? CONTINUE_CONVERSATION_ACTION;

    if (formValidation && variant === 'primary') {
      if (action && 'steps' in action) {
        const needsValidation = action.steps.some((step) =>
          step.type === ACTION_STEPS.ToAssistant
          || (
            step.type === ACTION_STEPS.Run && step.refType === 'mutation'
          )
        );
        if (needsValidation && !formValidation.validateForm()) return;
      } else if (actionType === CONTINUE_CONVERSATION_ACTION) {
        const valid = formValidation.validateForm();
        if (!valid) return;
      }
    }

    if (action && 'steps' in action) {
      void triggerAction(label, formName, action);
      return;
    }

    const actionParams = actionType === OPEN_URL_ACTION
      ? { url: legacyAction?.url }
      : {
        ...(legacyAction?.params ?? {}),
        ...(legacyAction?.context ? { context: legacyAction.context } : {}),
      };

    void triggerAction(label, formName, {
      type: actionType,
      params: actionParams,
    });
  };

  return (
    <view
      className={className}
      {...(isStreaming ? {} : ({ bindtap: onTap }))}
    >
      <text className='OpenUIButtonText'>{label}</text>
    </view>
  );
}

export const Button = defineComponent({
  name: 'Button',
  props: buttonPropsSchema,
  description: 'Clickable button',
  component: ButtonRenderer,
});

function ButtonsRenderer(
  { props, renderNode }: {
    props: { buttons: unknown[] };
    renderNode: (v: unknown) => ReactNode;
  },
) {
  return (
    <view className='OpenUIButtonGroup'>
      {renderNode(asArray(props.buttons))}
    </view>
  );
}

export const Buttons = defineComponent({
  name: 'Buttons',
  props: z.object({
    buttons: z.array(Button.ref),
  }),
  description: 'Button group',
  component: ButtonsRenderer,
});
