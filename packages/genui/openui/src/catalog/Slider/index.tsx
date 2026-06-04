// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BuiltinActionType } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import {
  SliderIndicator,
  SliderRoot,
  SliderThumb,
  SliderTrack,
} from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import { useTriggerAction } from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import { actionPropSchema } from '../Action/index.jsx';

const CONTINUE_CONVERSATION_ACTION = String(
  BuiltinActionType.ContinueConversation,
);
const OPEN_URL_ACTION = String(BuiltinActionType.OpenUrl);

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

const sliderPropsSchema = z.object({
  label: z.string().optional(),
  min: z.number().optional(),
  max: z.number(),
  value: z.number().optional(),
  step: z.number().optional(),
  action: actionPropSchema.optional(),
});

type SliderProps = z.infer<typeof sliderPropsSchema>;

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toRatio(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return (clamp(value, min, max) - min) / (max - min);
}

function fromRatio(
  ratio: number,
  min: number,
  max: number,
  step?: number,
): number {
  const range = max - min;
  if (range <= 0) return min;
  const raw = clamp(min + ratio * range, min, max);
  if (!step || step <= 0) return raw;
  return clamp(
    Number((min + Math.round((raw - min) / step) * step).toFixed(12)),
    min,
    max,
  );
}

function SliderRenderer({ props }: { props: SliderProps }) {
  const triggerAction = useTriggerAction();
  const min = toFiniteNumber(props.min, DEFAULT_MIN);
  const max = toFiniteNumber(props.max, DEFAULT_MAX);
  const step = props.step && props.step > 0 ? props.step : undefined;
  const range = max > min
    ? { min, max }
    : { min: DEFAULT_MIN, max: DEFAULT_MAX };
  const initial = toFiniteNumber(props.value, range.min);
  const [value, setValue] = useState<number>(initial);

  const onValueChange = (nextRatio: number) => {
    const next = fromRatio(nextRatio, range.min, range.max, step);
    setValue(next);
    if (!props.action) return;
    const legacyAction = ('steps' in props.action) ? undefined : props.action;
    const actionType = legacyAction?.type ?? CONTINUE_CONVERSATION_ACTION;
    const actionParams = actionType === OPEN_URL_ACTION
      ? { url: legacyAction?.url }
      : {
        ...(legacyAction?.params ?? {}),
        ...(legacyAction?.context ? { context: legacyAction.context } : {}),
      };
    void triggerAction(String(Math.round(next)), undefined, {
      type: actionType,
      params: actionParams,
    });
  };

  const stepProps = step
    ? { step: step / (range.max - range.min) }
    : {};
  const ratio = toRatio(value, range.min, range.max);

  return (
    <view className='OpenUISlider'>
      {props.label
        ? (
          <view className='OpenUISliderHeader'>
            <text className='OpenUISliderLabel'>{props.label}</text>
            <text className='OpenUISliderValue'>
              {String(Math.round(value))}
            </text>
          </view>
        )
        : null}
      <view className='OpenUISliderControl'>
        <SliderRoot
          {...stepProps}
          className='OpenUISliderRoot'
          value={ratio}
          onValueChange={onValueChange}
        >
          <SliderTrack className='OpenUISliderTrack'>
            <SliderIndicator className='OpenUISliderIndicator' />
            <SliderThumb className='OpenUISliderThumb'>
              <view className='OpenUISliderThumbDot' />
            </SliderThumb>
          </SliderTrack>
        </SliderRoot>
      </view>
    </view>
  );
}

export const Slider = defineComponent({
  name: 'Slider',
  props: sliderPropsSchema,
  description:
    'Continuous-value slider. Visual state updates locally during drag; the action fires for the LLM to persist the change.',
  component: SliderRenderer,
});
