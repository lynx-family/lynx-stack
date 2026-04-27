// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { NodeRenderer } from '../../core/A2UIRender.jsx';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export interface RowProps extends GenericComponentProps {
  /** Static child IDs array or template object. */
  children: string[] | { componentId: string; path: string };
  justify?:
    | 'start'
    | 'center'
    | 'end'
    | 'spaceBetween'
    | 'spaceAround'
    | 'spaceEvenly'
    | 'stretch';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export function Row(props: RowProps): import('@lynx-js/react').ReactNode {
  const children = props.children;
  const surface = props.surface;
  const dataContextPath = props.dataContextPath;
  const justify = props.justify as string | undefined ?? 'start';
  const align = props.align as string | undefined ?? 'stretch';
  const explicitChildren = Array.isArray(children) ? children : [];

  return (
    <view className={`row alignment-${align} distribution-${justify}`}>
      {explicitChildren.map((childId: string) => {
        const child = surface.components.get(childId);
        if (!child) return null;
        const childWithContext = dataContextPath
          ? { ...child, dataContextPath: dataContextPath }
          : child;
        const weight = (child as unknown as { weight?: number }).weight;
        if (typeof weight === 'number' && weight > 0) {
          return (
            <view
              key={childId}
              className='row-weighted-item'
              style={{ flex: `${weight} ${weight} 0`, minWidth: 0 }}
            >
              <NodeRenderer
                component={childWithContext}
                surface={surface}
              />
            </view>
          );
        }
        return (
          <NodeRenderer
            key={childId}
            component={childWithContext}
            surface={surface}
          />
        );
      })}
    </view>
  );
}
