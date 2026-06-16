// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';
import { stringLikeSchema, stringifyValue } from '../utils.js';

export const AudioPlayer = defineComponent({
  name: 'AudioPlayer',
  props: z.object({
    url: stringLikeSchema,
    description: stringLikeSchema.optional(),
  }),
  description: 'Audio attachment placeholder with URL and description.',
  component: ({ props }) => {
    const description = stringifyValue(props.description);
    const url = stringifyValue(props.url);

    return (
      <view className='OpenUIAudio'>
        <view className='OpenUIAudioIcon'>
          <text className='OpenUIAudioIconText'>music_note</text>
        </view>
        <view className='OpenUIAudioContent'>
          <text className='OpenUIAudioTitle'>{description || 'Audio'}</text>
          {url ? <text className='OpenUIAudioUrl'>{url}</text> : null}
        </view>
      </view>
    );
  },
});
