// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { NodeRenderer } from '../../core/A2UIRender.jsx';
import type { GenericComponentProps } from '../../core/types.js';

import './style.css';

/**
 * @a2uiCatalog Card
 */
export interface CardProps extends GenericComponentProps {
  child: string;
}

export function Card(props: CardProps): import('@lynx-js/react').ReactNode {
  const { child: childId, surface, dataContextPath } = props;
  const childComponent = surface.components.get(childId);
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
