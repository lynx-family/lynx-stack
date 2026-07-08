// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';

import '../../../styles/catalog/Divider.css';

export const Divider = defineComponent({
  name: 'Divider',
  props: z.object({
    axis: z.enum(['horizontal', 'vertical']).optional(),
  }),
  description: 'Horizontal or vertical divider.',
  component: ({ props }) => {
    const axis = props.axis === 'vertical' ? 'Vertical' : 'Horizontal';
    return <view className={`OpenUIDivider OpenUIDivider${axis}`} />;
  },
});
