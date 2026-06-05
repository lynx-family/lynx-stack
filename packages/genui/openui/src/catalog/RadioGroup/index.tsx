// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ActionPlan } from '@openuidev/lang-core';
import { BuiltinActionType } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Radio, RadioGroupRoot, RadioIndicator } from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import { useTriggerAction } from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import { actionPropSchema } from '../Action/index.jsx';

const CONTINUE_CONVERSATION_ACTION = String(
  BuiltinActionType.ContinueConversation,
);
const OPEN_URL_ACTION = String(BuiltinActionType.OpenUrl);

const HitSlop = {
  'hit-slop': {
    top: '8px' as `${number}px`,
    left: '8px' as `${number}px`,
    right: '8px' as `${number}px`,
    bottom: '8px' as `${number}px`,
  },
};

const radioGroupPropsSchema = z.object({
  items: z.array(z.string()),
  value: z.string().optional(),
  usageHint: z.enum(['default', 'card', 'row']).optional(),
  action: actionPropSchema.optional(),
});

type RadioGroupProps = z.infer<typeof radioGroupPropsSchema>;

function RadioGroupRenderer({ props }: { props: RadioGroupProps }) {
  const triggerAction = useTriggerAction();
  const usageHint = props.usageHint ?? 'default';
  const [selected, setSelected] = useState<string>(props.value ?? '');

  const onValueChange = (next: string) => {
    setSelected(next);
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

  const rootClassName = `OpenUIRadioGroup OpenUIRadioGroup-${usageHint}`;

  return (
    <view className={rootClassName}>
      <RadioGroupRoot value={selected} onValueChange={onValueChange}>
        <view className='OpenUIRadioGroupContainer'>
          {props.items.map((item) => (
            <view key={item} className='OpenUIRadioOption'>
              <Radio
                className='OpenUIRadioItem'
                value={item}
                radioProps={HitSlop}
              >
                <RadioIndicator className='OpenUIRadioIndicator'>
                  <view className='OpenUIRadioIndicatorDot' />
                </RadioIndicator>
              </Radio>
              <text className='OpenUIRadioLabel'>{item}</text>
            </view>
          ))}
        </view>
      </RadioGroupRoot>
    </view>
  );
}

export const RadioGroup = defineComponent({
  name: 'RadioGroup',
  props: radioGroupPropsSchema,
  description:
    'Single-choice radio group. Visual state updates locally on tap; the action fires for the LLM to persist the change.',
  component: RadioGroupRenderer,
});
