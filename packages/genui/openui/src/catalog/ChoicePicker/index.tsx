// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { useEffect, useRef, useState } from '@lynx-js/react';

import { useIsStreaming } from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import {
  booleanLikeSchema,
  booleanValue,
  isPathBinding,
  stringLikeSchema,
  stringifyValue,
} from '../utils.js';

const choicePickerPropsSchema = z.object({
  label: stringLikeSchema.optional(),
  options: z.union([z.array(stringLikeSchema), stringLikeSchema]),
  value: stringLikeSchema.optional(),
  variant: z.enum(['default', 'card']).optional(),
  displayStyle: z.enum(['list', 'chips', 'dropdown']).optional(),
  filterable: booleanLikeSchema.optional(),
});

type ChoicePickerProps = z.infer<typeof choicePickerPropsSchema>;

function ChoicePickerRenderer({ props }: { props: ChoicePickerProps }) {
  const isStreaming = useIsStreaming();
  const initialSelected = stringifyValue(props.value);
  const [selected, setSelected] = useState(initialSelected);
  const dirtyRef = useRef(false);
  const options = Array.isArray(props.options)
    ? props.options
    : [props.options];
  const displayStyle = props.displayStyle ?? 'chips';
  const variant = props.variant ?? 'default';
  const filterable = booleanValue(props.filterable);

  useEffect(() => {
    if (!dirtyRef.current) {
      setSelected(stringifyValue(props.value));
    }
  }, [props.value]);

  const onSelect = (next: string) => {
    dirtyRef.current = true;
    setSelected(next);
  };

  return (
    <view
      className={`OpenUIChoicePicker OpenUIChoicePicker-${displayStyle} OpenUIChoicePicker-${variant}`}
    >
      {props.label
        ? (
          <text className='OpenUIChoicePickerLabel'>
            {stringifyValue(props.label)}
          </text>
        )
        : null}
      {isPathBinding(props.options)
        ? (
          <text className='OpenUIChoicePickerHint'>
            {`options: {path: ${props.options.path}}`}
          </text>
        )
        : null}
      {filterable === null || filterable === undefined
        ? null
        : (
          <text className='OpenUIChoicePickerHint'>
            {`filterable: ${filterable ? 'true' : 'false'}`}
          </text>
        )}
      <view className='OpenUIChoicePickerOptions'>
        {options.map((option, index) => {
          const value = stringifyValue(option);
          const active = value === selected;
          return (
            <view
              key={`${value}-${index}`}
              className={active
                ? 'OpenUIChoiceItem OpenUIChoiceItemSelected'
                : 'OpenUIChoiceItem'}
              {...(isStreaming || !value
                ? {}
                : ({ bindtap: () => onSelect(value) }))}
            >
              <text className='OpenUIChoiceItemText'>{value}</text>
            </view>
          );
        })}
      </view>
    </view>
  );
}

export const ChoicePicker = defineComponent({
  name: 'ChoicePicker',
  props: choicePickerPropsSchema,
  description:
    'Choice picker rendered as selectable chips, list items, or a dropdown-like field.',
  component: ChoicePickerRenderer,
});
