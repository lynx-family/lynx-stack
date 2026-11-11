// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Loading as LoadingDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

import '../../../styles/catalog/Loading.css';

export const Loading: DefinedComponent<typeof LoadingDefinition.props> = {
  ...LoadingDefinition,
  component: ({ props }) => {
    const variant = props.variant ?? 'inline';
    const variantClass = variant === 'block'
      ? 'OpenUILoadingBlock'
      : 'OpenUILoadingInline';
    return (
      <view className={`OpenUILoading ${variantClass}`}>
        <view className='OpenUILoadingSkeleton OpenUILoadingSkeletonPrimary' />
        {variant === 'block'
          ? (
            <view className='OpenUILoadingSkeleton OpenUILoadingSkeletonSecondary' />
          )
          : null}
      </view>
    );
  },
};
