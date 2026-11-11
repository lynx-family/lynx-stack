// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ActionPlan } from '@openuidev/lang-core';
import { BuiltinActionType } from '@openuidev/lang-core';
import type { z } from 'zod/v4';

import { Radio, RadioGroupRoot, RadioIndicator } from '@lynx-js/lynx-ui';
import { useEffect, useRef, useState } from '@lynx-js/react';

import { RadioGroup as RadioGroupDefinition } from './definition.js';
import {
  useFormName,
  useGetFieldValue,
  useSetDefaultValue,
  useSetFieldValue,
  useTriggerAction,
} from '../../core/context.jsx';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/RadioGroup.css';

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

type RadioGroupProps = z.infer<typeof RadioGroupDefinition.props>;

function RadioGroupRenderer({ props }: { props: RadioGroupProps }) {
  const triggerAction = useTriggerAction();
  const formName = useFormName();
  const getFieldValue = useGetFieldValue();
  const setFieldValue = useSetFieldValue();
  const usageHint = props.usageHint ?? 'default';
  const [selected, setSelected] = useState<string>(props.value ?? '');
  const dirtyRef = useRef(false);
  const existingValue: unknown = props.name
    ? getFieldValue(formName, props.name)
    : undefined;

  useSetDefaultValue({
    ...(formName ? { formName } : {}),
    componentType: 'RadioGroup',
    name: props.name ?? '',
    existingValue,
    defaultValue: props.name ? props.value : undefined,
  });

  useEffect(() => {
    if (!dirtyRef.current) {
      const next = props.value ?? '';
      setSelected(next);
      if (props.name && props.value !== undefined) {
        setFieldValue(formName, 'RadioGroup', props.name, next, false);
      }
    }
  }, [formName, props.name, props.value, setFieldValue]);

  const onValueChange = (next: string) => {
    dirtyRef.current = true;
    setSelected(next);
    if (props.name) {
      setFieldValue(formName, 'RadioGroup', props.name, next, true);
    }
    if (!props.action) return;
    if ('steps' in props.action) {
      void triggerAction(next, formName, props.action as ActionPlan);
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
    void triggerAction(next, formName, {
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

export const RadioGroup: DefinedComponent<typeof RadioGroupDefinition.props> = {
  ...RadioGroupDefinition,
  component: RadioGroupRenderer,
};
