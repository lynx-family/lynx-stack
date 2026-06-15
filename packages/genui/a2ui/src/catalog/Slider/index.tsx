// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  SliderIndicator,
  SliderRoot,
  SliderThumb,
  SliderTrack,
} from '@lynx-js/lynx-ui';
import { useState } from '@lynx-js/react';

import {
  fromSliderRatio,
  normalizeSliderLabel,
  normalizeSliderNumber,
  normalizeSliderRange,
  toSliderRatio,
  toSliderStepRatio,
} from './utils.js';
import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Slider.css';

/**
 * Props for the built-in Slider catalog component.
 *
 * @a2uiCatalog Slider
 */
export interface SliderProps extends GenericComponentProps {
  /** The label for the slider. */
  label?: string | { path: string } | {
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
  /** The minimum value of the slider. */
  min?: number;
  /** The maximum value of the slider. */
  max: number;
  /** The current value of the slider. */
  value: number | { path: string } | {
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
  /** A list of checks to perform. */
  checks?: Array<{
    /** The condition that indicates whether the check passes. */
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
    /** The error message to display if the check fails. */
    message: string;
  }>;
}

/**
 * Render a numeric slider bound to the surface data model.
 */
export function Slider(
  props: SliderProps,
): import('@lynx-js/react').ReactNode {
  const {
    id,
    label,
    max,
    min,
    setValue,
    surface,
    dataContextPath,
  } = props;
  const minValue = min ?? props['minValue'];
  const maxValue = max ?? props['maxValue'];
  const range = normalizeSliderRange(minValue, maxValue);
  const step = normalizeSliderNumber(props['step'], Number.NaN);
  const stepRatio = toSliderStepRatio(step, range);
  const stepProps = stepRatio === undefined ? {} : { step: stepRatio };
  const ratio = toSliderRatio(props.value, range);
  const [displayValue, setDisplayValue] = useState<number>(
    Math.round(fromSliderRatio(ratio, range, step)),
  );
  const labelText = normalizeSliderLabel(label);
  const checks = props.checks as CheckLike[] | undefined;

  const { ok, firstFailureMessage } = useChecks({
    checks,
    componentId: id ?? '',
    surface,
    dataContextPath,
  });

  const handleValueChange = (nextRatio: number) => {
    const nextValue = fromSliderRatio(nextRatio, range, step);
    setValue?.('value', nextValue);
    setDisplayValue(Math.round(nextValue));
  };

  return (
    <view
      key={id}
      className={`slider${ok ? '' : ' slider-invalid'}`}
    >
      {labelText
        ? (
          <view className='slider-header'>
            <text className='slider-label'>{labelText}</text>
            <text className='slider-value'>{String(displayValue)}</text>
          </view>
        )
        : null}
      <view className='slider-control'>
        <SliderRoot
          {...stepProps}
          className='slider-root'
          value={ratio}
          onValueChange={handleValueChange}
        >
          <SliderTrack className='slider-track'>
            <SliderIndicator className='slider-indicator' />
            <SliderThumb className='slider-thumb'>
              <view className='slider-thumb-dot' />
            </SliderThumb>
          </SliderTrack>
        </SliderRoot>
      </view>
      {!ok && firstFailureMessage
        ? <text className='slider-error'>{firstFailureMessage}</text>
        : null}
    </view>
  );
}
