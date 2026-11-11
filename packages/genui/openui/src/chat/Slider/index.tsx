// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  SliderIndicator,
  SliderRoot,
  SliderThumb,
  SliderTrack,
} from '@lynx-js/lynx-ui';

import { Slider as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { useChatField } from '../useChatField.js';
import '../../../styles/catalog/ChatSlider.css';

/** Chat slider preserving the upstream array-valued state contract. */
export const Slider: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const min = Number.isFinite(props.min) ? props.min : 0;
    const max = Number.isFinite(props.max) && props.max > min
      ? props.max
      : min + 1;
    const range = max - min;
    const step = props.step && props.step > 0
      ? props.step
      : (props.variant === 'discrete' ? 1 : undefined);
    const field = useChatField<number[]>(
      props.name,
      props.value,
      props.defaultValue ?? [min],
      props.rules,
      value => value[0],
    );
    const values = field.value.length ? field.value : [min];
    return (
      <view className='OpenUIChatSlider'>
        <text className='OpenUIChatSliderLabel'>
          {props.label ?? props.name}
        </text>
        {values.map((value, index) => (
          <view key={index} className='OpenUIChatSliderControl'>
            <text className='OpenUIChatSliderValue'>
              {values.length > 1 ? `${index + 1}: ${value}` : String(value)}
            </text>
            <SliderRoot
              className='OpenUIChatSliderRoot'
              value={Math.min(1, Math.max(0, (value - min) / range))}
              {...(step ? { step: step / range } : {})}
              disabled={field.streaming}
              onValueChange={ratio => {
                const raw = min + Math.min(1, Math.max(0, ratio)) * range;
                const snapped = step
                  ? min + Math.round((raw - min) / step) * step
                  : raw;
                field.update(previous => {
                  const result = previous.length ? [...previous] : [min];
                  result[index] = Number(
                    Math.max(
                      result[index - 1] ?? min,
                      Math.min(result[index + 1] ?? max, snapped),
                    ).toFixed(8),
                  );
                  return result;
                });
              }}
              onValueCommit={() =>
                field.validate(field.read())}
            >
              <SliderTrack className='OpenUIChatSliderTrack'>
                <SliderIndicator className='OpenUIChatSliderIndicator' />
                <SliderThumb className='OpenUIChatSliderThumb'>
                  <view className='OpenUIChatSliderDot' />
                </SliderThumb>
              </SliderTrack>
            </SliderRoot>
          </view>
        ))}
        {field.error && (
          <text className='OpenUIChatSliderError'>{field.error}</text>
        )}
      </view>
    );
  },
};
