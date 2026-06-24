// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ActionPlan } from '@openuidev/lang-core';
import { BuiltinActionType } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { useEffect, useRef, useState } from '@lynx-js/react';

import {
  useFormName,
  useGetFieldValue,
  useIsStreaming,
  useSetDefaultValue,
  useSetFieldValue,
  useTriggerAction,
} from '../../core/context.jsx';
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
    name: z.string().optional(),
  }),
  description:
    'Toggleable checkbox. Visual state updates locally on tap; the action fires for the LLM to persist the change.',
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const formName = useFormName();
    const isStreaming = useIsStreaming();
    const getFieldValue = useGetFieldValue();
    const setFieldValue = useSetFieldValue();
    const [checked, setChecked] = useState<boolean>(props.value === true);
    const dirtyRef = useRef(false);
    const existingValue: unknown = props.name
      ? getFieldValue(formName, props.name)
      : undefined;

    useSetDefaultValue({
      ...(formName ? { formName } : {}),
      componentType: 'CheckBox',
      name: props.name ?? '',
      existingValue,
      defaultValue: props.name && props.value !== undefined
        ? props.value === true
        : undefined,
    });

    useEffect(() => {
      if (!dirtyRef.current) {
        const next = props.value === true;
        setChecked(next);
        if (props.name && props.value !== undefined) {
          setFieldValue(formName, 'CheckBox', props.name, next, false);
        }
      }
    }, [formName, props.name, props.value, setFieldValue]);

    const onChange = (next: boolean) => {
      dirtyRef.current = true;
      setChecked(next);
      if (props.name) {
        setFieldValue(formName, 'CheckBox', props.name, next, true);
      }
      if (isStreaming || !props.action) return;
      if ('steps' in props.action) {
        void triggerAction(props.label, formName, props.action as ActionPlan);
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
      void triggerAction(props.label, formName, {
        type: actionType,
        params: actionParams,
      });
    };
    const onToggle = () => onChange(!checked);

    return (
      <view
        className='OpenUICheckBoxRow'
        {...(isStreaming ? {} : ({ bindtap: onToggle }))}
      >
        <view
          className={checked
            ? 'OpenUICheckBoxInput ui-checked'
            : 'OpenUICheckBoxInput'}
        >
          {checked ? <text className='OpenUICheckBoxMark'>✓</text> : null}
        </view>
        <view className='OpenUICheckBoxLabelHitbox'>
          <text className='OpenUICheckBoxLabel'>{props.label}</text>
        </view>
      </view>
    );
  },
});
