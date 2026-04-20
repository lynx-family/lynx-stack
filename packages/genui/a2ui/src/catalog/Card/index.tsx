// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { NodeRenderer } from '../../core/A2UIRender.jsx';
import type { ComponentProps } from '../../core/ComponentRegistry.js';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

export interface CardProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function Card(
  props: GenericComponentProps,
): import('@lynx-js/react').ReactNode {
  const { child: childId, surface, dataContextPath } = props;
  const childComponent = surface.components.get(childId as string);
  const childWithContext = childComponent && dataContextPath
    ? { ...childComponent, dataContextPath: dataContextPath }
    : childComponent;

  return (
    <view className='card card-elevated'>
      {childWithContext && (
        <NodeRenderer
          component={childWithContext}
          surface={surface}
        />
      )}
    </view>
  );
}
