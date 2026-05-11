// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.js';

export const Tag = defineComponent({
  name: 'Tag',
  props: z.object({
    text: z.string(),
  }),
  description: 'Tag',
  component: ({ props }) => (
    <view className='OpenUITag'>
      <text className='OpenUITagText'>{props.text}</text>
    </view>
  ),
});
