// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BuiltinActionType } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Checkbox, CheckboxIndicator } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import { useTriggerAction } from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import { actionPropSchema } from '../Action/index.jsx';

const CONTINUE_CONVERSATION_ACTION = String(
  BuiltinActionType.ContinueConversation,
);
const OPEN_URL_ACTION = String(BuiltinActionType.OpenUrl);

export const CheckBox = defineComponent({
  name: 'CheckBox',
  props: z.object({
    label: z.string(),
    value: z.boolean().optional(),
    action: actionPropSchema.optional(),
  }),
  description:
    'Toggleable checkbox. Visual state updates locally on tap; the action fires for the LLM to persist the change.',
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const [checked, setChecked] = useState<boolean>(props.value === true);

    const onChange = (next: boolean) => {
      setChecked(next);
      if (!props.action) return;
      const legacyAction = ('steps' in props.action)
        ? undefined
        : props.action;
      const actionType = legacyAction?.type ?? CONTINUE_CONVERSATION_ACTION;
      const actionParams = actionType === OPEN_URL_ACTION
        ? { url: legacyAction?.url }
        : {
          ...(legacyAction?.params ?? {}),
          ...(legacyAction?.context ? { context: legacyAction.context } : {}),
        };
      void triggerAction(props.label, undefined, {
        type: actionType,
        params: actionParams,
      });
    };

    return (
      <view className='OpenUICheckBoxRow'>
        <Checkbox
          checked={checked}
          onChange={onChange}
          className='OpenUICheckBoxInput'
        >
          <CheckboxIndicator>
            <text>✓</text>
          </CheckboxIndicator>
        </Checkbox>
        <text className='OpenUICheckBoxLabel'>{props.label}</text>
      </view>
    );
  },
});
