// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/Loading.css';

/**
 * Props for the built-in Loading catalog component.
 *
 * @a2uiCatalog Loading
 */
export interface LoadingProps extends GenericComponentProps {
  /** Visual density for the skeleton placeholder. */
  variant?: 'inline' | 'block';
}

/**
 * Render a lightweight loading indicator.
 */
export function Loading(
  props: LoadingProps,
): import('@lynx-js/react').ReactNode {
  const variant = props.variant ?? 'inline';

  return (
    <view className={`loading loading-${variant}`}>
      <view className='loading-skeleton loading-skeleton-primary' />
      {variant === 'block'
        ? <view className='loading-skeleton loading-skeleton-secondary' />
        : null}
    </view>
  );
}
