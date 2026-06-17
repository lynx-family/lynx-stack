// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';
import { stringLikeSchema, stringifyValue } from '../utils.js';

export const Video = defineComponent({
  name: 'Video',
  props: z.object({
    url: stringLikeSchema,
    title: stringLikeSchema.optional(),
  }),
  description: 'Video attachment placeholder with URL.',
  component: ({ props }) => {
    const title = stringifyValue(props.title) || 'Video';
    const url = stringifyValue(props.url);

    return (
      <view className='OpenUIVideo'>
        <view className='OpenUIVideoPoster'>
          <text className='OpenUIVideoPlay'>play_arrow</text>
        </view>
        <view className='OpenUIVideoMeta'>
          <text className='OpenUIVideoTitle'>{title}</text>
          {url ? <text className='OpenUIVideoUrl'>{url}</text> : null}
        </view>
      </view>
    );
  },
});
