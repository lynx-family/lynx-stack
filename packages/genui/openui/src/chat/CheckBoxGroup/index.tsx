// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { Checkbox, CheckboxIndicator } from '@lynx-js/lynx-ui';
import { useEffect } from '@lynx-js/react';

import { CheckBoxGroup as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import type { CheckBoxItem } from '../CheckBoxItem/definition.js';
import { childProps } from '../elements.js';
import { useChatField } from '../useChatField.js';
import '../../../styles/catalog/ChatCheckBoxGroup.css';

/** Chat checkbox group that merges changes into the complete shared binding. */
export const CheckBoxGroup: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => {
    const items = (props.items ?? []).map(node =>
      childProps<z.infer<typeof CheckBoxItem.props>>(node)
    );
    const field = useChatField<Record<string, boolean>>(
      props.name,
      props.value,
      {},
      props.rules,
      value =>
        Object.fromEntries(
          items.map(
            item => [
              item.name ?? '',
              value[item.name ?? ''] ?? item.defaultChecked ?? false,
            ],
          ),
        ),
    );
    useEffect(() => {
      if (field.streaming) return;
      const current = field.read();
      const missing = items.filter(item =>
        item.name && current[item.name] === undefined
      );
      if (missing.length) {
        field.update(previous => ({
          ...previous,
          ...Object.fromEntries(
            missing.map(item => [item.name!, item.defaultChecked ?? false]),
          ),
        }));
      }
    });
    return (
      <view className='OpenUIChatChecks'>
        {items.map(item => (
          <Checkbox
            key={item.name}
            className='OpenUIChatCheckRow'
            checked={field.value[item.name ?? ''] ?? item.defaultChecked
              ?? false}
            disabled={field.streaming}
            onChange={checked => {
              field.update(previous => ({
                ...previous,
                [item.name ?? '']: checked,
              }));
              field.validate(field.read());
            }}
          >
            <CheckboxIndicator className='OpenUIChatCheckIndicator'>
              <text className='OpenUIChatCheckMark'>✓</text>
            </CheckboxIndicator>
            <view className='OpenUIChatCheckLabels'>
              <text className='OpenUIChatCheckLabel'>{item.label ?? ''}</text>
              {item.description && (
                <text className='OpenUIChatCheckDescription'>
                  {item.description}
                </text>
              )}
            </view>
          </Checkbox>
        ))}
        {field.error && (
          <text className='OpenUIChatCheckError'>{field.error}</text>
        )}
      </view>
    );
  },
};
