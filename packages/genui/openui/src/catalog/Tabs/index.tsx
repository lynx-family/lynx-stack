// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { useEffect, useRef, useState } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { useIsStreaming } from '../../core/context.jsx';
import { defineComponent } from '../../core/library.jsx';
import { stringLikeSchema, stringifyValue } from '../utils.js';

import '../../../styles/catalog/Tabs.css';

const tabSchema = z.object({
  value: z.string(),
  title: stringLikeSchema,
  child: z.any(),
});

const tabsPropsSchema = z.object({
  tabs: z.array(tabSchema),
  value: z.string().optional(),
});

type TabsProps = z.infer<typeof tabsPropsSchema>;

function TabsRenderer(
  { props, renderNode }: {
    props: TabsProps;
    renderNode: (v: unknown) => ReactNode;
  },
) {
  const isStreaming = useIsStreaming();
  const firstValue = props.tabs[0]?.value ?? '';
  const [active, setActive] = useState(props.value ?? firstValue);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) {
      setActive(props.value ?? firstValue);
    }
  }, [firstValue, props.value]);

  if (!props.tabs.length) return null;

  const activeTab = props.tabs.find((tab) => tab.value === active)
    ?? props.tabs[0];

  const onSelect = (value: string) => {
    dirtyRef.current = true;
    setActive(value);
  };

  return (
    <view className='OpenUITabs'>
      <view className='OpenUITabList'>
        {props.tabs.map((tab) => {
          const selected = tab.value === activeTab?.value;
          return (
            <view
              key={tab.value}
              className={selected
                ? 'OpenUITabTrigger OpenUITabTriggerActive'
                : 'OpenUITabTrigger OpenUITabTriggerInactive'}
              {...(isStreaming
                ? {}
                : ({ bindtap: () => onSelect(tab.value) }))}
            >
              <text className='OpenUITabTriggerText'>
                {stringifyValue(tab.title) || tab.value}
              </text>
            </view>
          );
        })}
      </view>
      <view className='OpenUITabBody'>
        {activeTab ? renderNode(activeTab.child) : null}
      </view>
    </view>
  );
}

export const Tabs = defineComponent({
  name: 'Tabs',
  props: tabsPropsSchema,
  description:
    'Tabbed content switcher. Each tab has value, title, and child content.',
  component: TabsRenderer,
});
