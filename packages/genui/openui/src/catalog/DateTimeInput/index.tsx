// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';
import {
  booleanLikeSchema,
  booleanValue,
  stringLikeSchema,
  stringifyValue,
} from '../utils.js';

import '../../../styles/catalog/DateTimeInput.css';

const dateTimeInputPropsSchema = z.object({
  value: stringLikeSchema,
  enableDate: booleanLikeSchema.optional(),
  enableTime: booleanLikeSchema.optional(),
  min: stringLikeSchema.optional(),
  max: stringLikeSchema.optional(),
  label: stringLikeSchema.optional(),
});

export const DateTimeInput = defineComponent({
  name: 'DateTimeInput',
  props: dateTimeInputPropsSchema,
  description:
    'Date/time value display with optional label, min/max, and enabled date/time hints.',
  component: ({ props }) => {
    const enableDate = booleanValue(props.enableDate);
    const enableTime = booleanValue(props.enableTime);
    const min = stringifyValue(props.min);
    const max = stringifyValue(props.max);

    return (
      <view className='OpenUIDateTimeInput'>
        {props.label
          ? (
            <text className='OpenUIDateTimeLabel'>
              {stringifyValue(props.label)}
            </text>
          )
          : null}
        <text className='OpenUIDateTimeValue'>
          {stringifyValue(props.value)}
        </text>
        <text className='OpenUIDateTimeHint'>
          {`enableDate=${
            enableDate === null ? '-' : (enableDate ? 'true' : 'false')
          }, enableTime=${
            enableTime === null ? '-' : (enableTime ? 'true' : 'false')
          }`}
        </text>
        {min || max
          ? (
            <text className='OpenUIDateTimeHint'>
              {`min=${min || '-'}, max=${max || '-'}`}
            </text>
          )
          : null}
      </view>
    );
  },
});
