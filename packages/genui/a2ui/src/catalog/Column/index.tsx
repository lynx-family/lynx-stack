// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { NodeRenderer } from '../../react/A2UIRenderer.jsx';
import { useDataBinding } from '../../react/useDataBinding.js';
import type {
  ComponentInstance,
  GenericComponentProps,
  Surface,
} from '../../store/types.js';

import '../../../styles/catalog/Column.css';

const buildChild = (
  surface: Surface,
  childId: string,
  dataContextPath: string | undefined,
  childPath?: string,
  key = childId,
): {
  key: string;
  component: ComponentInstance;
} | null => {
  const child = surface.components.get(childId);
  if (!child) return null;
  let childWithContext = child;
  if (childPath) {
    childWithContext = { ...child, dataContextPath: childPath };
  } else if (dataContextPath) {
    childWithContext = { ...child, dataContextPath };
  }
  return {
    key,
    component: childWithContext,
  };
};

/**
 * @a2uiCatalog Column
 */
export interface ColumnProps extends GenericComponentProps {
  /** Static child IDs array or template object. */
  children: string[] | { componentId: string; path: string };
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?:
    | 'start'
    | 'center'
    | 'end'
    | 'stretch'
    | 'spaceBetween'
    | 'spaceAround'
    | 'spaceEvenly';
}

export function Column(
  props: ColumnProps,
): import('@lynx-js/react').ReactNode {
  const {
    children,
    surface,
    dataContextPath,
    justify = 'start',
    align = 'stretch',
  } = props;

  const isDynamic = children && !Array.isArray(children)
    && typeof children === 'object';
  const template = isDynamic
    ? children
    : undefined;

  const [columnData, , fullPath] = useDataBinding<Record<string, unknown>[]>(
    template ? { path: template.path } : undefined,
    surface,
    dataContextPath,
    [],
  );

  const childList = Array.isArray(children)
    ? children.map((childId: string) =>
      buildChild(surface, childId, dataContextPath)
    )
    : (Array.isArray(columnData) ? columnData : []).map((item, index) => {
      const key = item && typeof item === 'object' && 'key' in item
        ? String(item['key'])
        : `${index}`;
      const itemPath = `${fullPath}/${index}`;
      return buildChild(
        surface,
        template?.componentId ?? '',
        dataContextPath,
        itemPath,
        key,
      );
    });

  return (
    <view
      className={`column alignment-${align} distribution-${justify}`}
    >
      {childList.map((item) => {
        if (!item) return null;
        const weight = item.component.weight;
        if (typeof weight === 'number' && weight > 0) {
          return (
            <view
              key={item.key}
              className={`column-weighted-item column-weighted-item-${weight}`}
              style={{ flex: `${weight} ${weight} 0`, minHeight: 0 }}
            >
              <NodeRenderer
                component={item.component}
                surface={surface}
              />
            </view>
          );
        }
        return (
          <NodeRenderer
            key={item.key}
            component={item.component}
            surface={surface}
          />
        );
      })}
    </view>
  );
}
