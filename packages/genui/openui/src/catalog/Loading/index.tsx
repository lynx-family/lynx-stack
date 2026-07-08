// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';

import '../../../styles/catalog/Loading.css';

export const Loading = defineComponent({
  name: 'Loading',
  props: z.object({
    variant: z.enum(['inline', 'block']).optional(),
  }),
  description: 'Skeleton placeholder while content loads.',
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
});
