// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { useEffect, useRef, useState } from '@lynx-js/react';

import { SectionBlock as definition } from './definition.js';
import { useIsStreaming } from '../../core/context.jsx';
import type { DefinedComponent } from '../../core/library.jsx';
import { childKey, childProps } from '../elements.js';
import type { SectionItem } from '../SectionItem/definition.js';
import '../../../styles/catalog/ChatSectionBlock.css';

/** Foldable Chat sections with streaming-aware expansion. */
export const SectionBlock: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => {
    const streaming = useIsStreaming();
    const items = (props.sections ?? []).map((node, index) => ({
      key: childKey(node, index),
      ...childProps<z.infer<typeof SectionItem.props>>(node),
    }));
    const first = items[0]?.value;
    const last = items[items.length - 1]?.value;
    const [open, setOpen] = useState<string[]>(first ? [first] : []);
    const touched = useRef(false);
    const wasStreaming = useRef(streaming);
    useEffect(() => {
      const finished = wasStreaming.current && !streaming;
      if (!touched.current) {
        if (streaming && last) {
          setOpen(previous =>
            previous.includes(last) ? previous : [...previous, last]
          );
        } else if (finished || first) {
          setOpen(previous =>
            finished || previous.length === 0
              ? (first ? [first] : [])
              : previous
          );
        }
      }
      wasStreaming.current = streaming;
    }, [streaming, first, last]);
    return (
      <view className='OpenUIChatSections'>
        {items.map(item => {
          const value = item.value ?? item.key;
          const expanded = props.isFoldable === false || open.includes(value);
          return (
            <view key={value} className='OpenUIChatSection'>
              <view
                className='OpenUIChatSectionTrigger'
                accessibility-role={props.isFoldable === false
                  ? undefined
                  : 'button'}
                bindtap={props.isFoldable === false ? undefined : () => {
                  touched.current = true;
                  setOpen(previous =>
                    previous.includes(value)
                      ? previous.filter(id => id !== value)
                      : [...previous, value]
                  );
                }}
              >
                <text className='OpenUIChatSectionTitle'>
                  {item.trigger ?? ''}
                </text>
                {props.isFoldable !== false && (
                  <text className='OpenUIChatSectionChevron'>
                    {expanded ? '−' : '+'}
                  </text>
                )}
              </view>
              <view
                className='OpenUIChatSectionContent'
                style={{ display: expanded ? 'flex' : 'none' }}
              >
                {renderNode(item.content ?? [])}
              </view>
            </view>
          );
        })}
      </view>
    );
  },
};
