// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { NodeRenderer } from '../../core/A2UIRender.jsx';
import type { ComponentProps } from '../../core/ComponentRegistry.js';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export interface RowProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function Row(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const children = props['children'];
  const surface = props.surface;
  const dataContextPath = props.dataContextPath;
  const justify = props['justify'] as string | undefined ?? 'start';
  const align = props['align'] as string | undefined ?? 'stretch';
  const explicitChildren = Array.isArray(children) ? children : [];

  return (
    <view className={`row alignment-${align} distribution-${justify}`}>
      {explicitChildren.map((childId: string) => {
        const child = surface.components.get(childId);
        if (!child) return null;
        const childWithContext = dataContextPath
          ? { ...child, dataContextPath: dataContextPath }
          : child;
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
