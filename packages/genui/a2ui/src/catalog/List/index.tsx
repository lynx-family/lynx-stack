// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { NodeRenderer } from '../../core/A2UIRender.jsx';
import type { GenericComponentProps } from '../../core/types.js';
import { useDataBinding } from '../../core/useDataBinding.js';

import './style.css';

/**
 * Props for the List catalog component.
 */
export interface ListProps extends GenericComponentProps {
  /** Static child IDs array or template object. */
  children: string[] | { componentId: string; path: string };
  direction?: 'horizontal' | 'vertical';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * Render a scrollable list container.
 */
export function List(
  props: ListProps,
): import('@lynx-js/react').ReactNode {
  const { children, surface, dataContextPath, direction = 'vertical' } = props;

  interface ListItem {
    key: string;
    component: v0_9.AnyComponent & { dataContextPath?: string };
  }

  const isDynamic = children && !Array.isArray(children)
    && typeof children === 'object';
  const template = isDynamic
    ? (children as { path: string; componentId: string })
    : undefined;

  const [listData, , fullPath] = useDataBinding<Record<string, unknown>[]>(
    template ? { path: template.path } : undefined,
    surface,
    dataContextPath,
    [],
  );

  let content: (ListItem | null)[] = [];
  if (Array.isArray(children)) {
    content = children.map((childId: string) => {
      const child = surface.components.get(childId);
      if (!child) return null;
      // Propagate dataContextPath
      const childWithContext = dataContextPath
        ? { ...child, dataContextPath: dataContextPath }
        : child;
      return {
        key: childId,
        component: childWithContext,
      };
    });
  } else if (template) {
    const items = Array.isArray(listData) ? listData : [];

    content = items.map((item, index) => {
      const componentId = template.componentId;
      const child = surface.components.get(componentId);
      if (!child) return null;

      const key = item && typeof item === 'object' && 'key' in item
        ? String(item['key'])
        : `${index}`;

      const itemPath = `${fullPath}/${index}`;
      const childWithContext = { ...child, dataContextPath: itemPath };

      return {
        key: key,
        component: childWithContext,
      };
    });
  }

  return (
    <list
      className={`list list-${String(direction)}`}
      scroll-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
      list-type='single'
      span-count={1}
    >
      {content.map((item) => {
        if (!item) return null;
        return (
          <list-item key={item.key} item-key={item.key}>
            <NodeRenderer
              component={item.component}
              surface={surface}
            />
          </list-item>
        );
      })}
    </list>
  );
}
