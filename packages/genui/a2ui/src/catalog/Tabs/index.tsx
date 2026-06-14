// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState } from '@lynx-js/react';

import { NodeRenderer } from '../../react/A2UIRenderer.jsx';
import type { GenericComponentProps, Surface } from '../../store/types.js';

import '../../../styles/catalog/Tabs.css';

/**
 * Props for the built-in Tabs catalog component.
 *
 * @a2uiCatalog Tabs
 */
export interface TabsProps extends GenericComponentProps {
  tabs: Array<{
    title: string;
    child: string;
  }>;
}

function TabsHeader(props: {
  active: boolean;
  onSelect: () => void;
  tab: {
    title: string;
    child: string;
  };
}): import('@lynx-js/react').ReactNode {
  return (
    <view
      className={`tabs-header${props.active ? ' tabs-header-active' : ''}`}
      bindtap={props.onSelect}
    >
      <text className='tabs-header-text'>{props.tab.title}</text>
    </view>
  );
}

function TabsContent(props: {
  activeTab:
    | {
      title: string;
      child: string;
    }
    | undefined;
  surface: Surface;
}): import('@lynx-js/react').ReactNode {
  const childId = props.activeTab?.child;
  if (!childId) return null;

  const child = props.surface.components.get(childId);
  if (!child) return null;

  return <NodeRenderer component={child} surface={props.surface} />;
}

/**
 * Render a tabbed container whose tabs reference child component ids.
 */
export function Tabs(props: TabsProps): import('@lynx-js/react').ReactNode {
  const { surface, tabs } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = tabs.length > 0
    ? Math.min(selectedIndex, tabs.length - 1)
    : 0;
  const activeTab = tabs[activeIndex];

  if (tabs.length === 0) {
    return <view className='tabs' />;
  }

  return (
    <view className='tabs'>
      <view className='tabs-headers'>
        {tabs.map((tab, index) => (
          <TabsHeader
            key={`${index}-${tab.child}`}
            active={index === activeIndex}
            onSelect={() => setSelectedIndex(index)}
            tab={tab}
          />
        ))}
      </view>
      <view className='tabs-content'>
        <TabsContent
          activeTab={activeTab}
          surface={surface}
        />
      </view>
    </view>
  );
}
