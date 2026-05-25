// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { NodeRenderer } from '../../react/A2UIRenderer.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Card.css';

/**
 * @a2uiCatalog Card
 */
export interface CardProps extends GenericComponentProps {
  child: string;
  variant?: 'elevated' | 'outlined' | 'filled' | 'ghost';
  weight?: number;
}

export function Card(props: CardProps): import('@lynx-js/react').ReactNode {
  const { child: childId, surface, dataContextPath } = props;
  const childComponent = surface.components.get(childId);
  const childWithContext = childComponent && dataContextPath
    ? { ...childComponent, dataContextPath }
    : childComponent;
  const variant = props.variant ?? 'elevated';
  const weightClass = typeof props.weight === 'number'
    ? 'card-weighted'
    : '';

  return (
    <view className={`card card-${variant} ${weightClass}`.trim()}>
      {childWithContext && (
        <NodeRenderer component={childWithContext} surface={surface} />
      )}
    </view>
  );
}
