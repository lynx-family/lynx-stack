// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { DateTimeInput as DateTimeInputDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { booleanValue, stringifyValue } from '../utils.js';

import '../../../styles/catalog/DateTimeInput.css';

export const DateTimeInput: DefinedComponent<
  typeof DateTimeInputDefinition.props
> = {
  ...DateTimeInputDefinition,
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
};
