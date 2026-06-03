// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';

export const CardHeader = defineComponent({
  name: 'CardHeader',
  props: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
  }),
  description: 'Card header with title and optional subtitle.',
  component: ({ props }) => (
    <view className='OpenUICardHeader'>
      <text className='OpenUICardHeaderTitle'>{props.title}</text>
      {props.subtitle
        ? <text className='OpenUICardHeaderSubtitle'>{props.subtitle}</text>
        : null}
    </view>
  ),
});
